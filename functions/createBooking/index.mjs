import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLE_NAME } from "../../services/db.mjs";

const CORS_HEADERS = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*",
};

export const handler = async (event) => {

	try {
		const body = JSON.parse(event.body);

		const requiredFields = [
			"guestName",
			"guestEmail",
			"guestCount",
			"roomTypes",
			"checkIn",
			"checkOut",
		];

		for (const field of requiredFields) {
			if (!body[field]) {
				return {
					statusCode: 400,
					headers: CORS_HEADERS,
					body: JSON.stringify({
						success: false,
						message: `Missing required field: ${field}`,
					}),
				};
			}
		}

		if (!Array.isArray(body.roomTypes) || body.roomTypes.length === 0) {
			return {
				statusCode: 400,
				headers: CORS_HEADERS,
				body: JSON.stringify({
					success: false,
					message: "'roomTypes' must be an array and can't be empty. ",
				}),
			};
		}
	
		for (const room of body.roomTypes) {
			if (!room.type || !room.rooms || !room.guests) {
				return {
					statusCode: 400,
					headers: CORS_HEADERS,
					body: JSON.stringify({
						success: false,
						message: "Room type, number of rooms or number of guests missing.",
					}),
				};
			}
		}
	
		for (const room of body.roomTypes) {
			const guestValidation = validateGuestCapacity(
				room.type,
				room.guests,
				room.rooms
			);
			if (!guestValidation.valid) {
				return {
					statusCode: 400,
					headers: CORS_HEADERS,
					body: JSON.stringify({
						success: false,
						message: guestValidation.message,
					}),
				};
			}
		}
	
		for (const room of body.roomTypes) {
			const roomAvailability = await checkRoomAvailability(
				room.type,
				room.rooms
			);
			if (!roomAvailability.available) {
				return {
					statusCode: 400,
					headers: CORS_HEADERS,
					body: JSON.stringify({
						success: false,
						message: roomAvailability.message,
					}),
				};
			}
		}

		const totalPrice = calculateTotalPrice(
			body.roomTypes,
			body.checkIn,
			body.checkOut
		);

		const totalNumberOfRooms = body.roomTypes.reduce(
			(total, room) => total + room.rooms,
			0
		);

		const bookingId = uuidv4();
		const booking = {
			PK: "BOOKING#",
			SK: `ID#${bookingId}`,
			bookingId: bookingId,
			guestName: body.guestName,
			guestEmail: body.guestEmail,
			guestCount: body.guestCount,
			roomTypes: body.roomTypes,
			totalNumberOfRooms: totalNumberOfRooms,
			checkIn: body.checkIn,
			checkOut: body.checkOut,
			totalPrice: totalPrice,
			createdAt: new Date().toISOString(),
			status: "confirmed",
		};

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME,
				Item: booking,
			})
		);

		for (const room of body.roomTypes) {
			await updateBookedRooms(room.type, room.rooms);
		}

		return {
			statusCode: 201,
			headers: CORS_HEADERS,
			body: JSON.stringify({
				success: true,
				message: "Booking created successfully",
				booking: booking,
			}),
		};
	} catch (error) {
		console.error("Error creating booking:", error);

		return {
			statusCode: 500,
			headers: CORS_HEADERS,
			body: JSON.stringify({
				success: false,
				message: "Failed to create booking",
				error: error.message,
			}),
		};
	}
};

function calculateTotalPrice(roomTypes, checkIn, checkOut) {
	const roomPrices = { enkel: 500, dubbel: 1000, svit: 1500 };
	const nights = calculateNights(checkIn, checkOut);

	if (nights <= 0) {
		throw new Error("Invalid date range: checkout must be after checkin");
	}

	let total = 0;

	for (const room of roomTypes) {
		const pricePerNight = roomPrices[room.type.toLowerCase()];
		if (!pricePerNight) {
			throw new Error(`Unknown room type: ${room.type}`);
		}
		total += pricePerNight * room.rooms * nights;
	}
	return total;
}

function calculateNights(checkIn, checkOut) {

	const checkInDate = new Date(checkIn);
	const checkOutDate = new Date(checkOut);
	const timeDifference = checkOutDate.getTime() - checkInDate.getTime();
	return Math.ceil(timeDifference / (1000 * 3600 * 24));
}

function validateGuestCapacity(roomType, guestCount, numberOfRooms) {
	const roomCapacities = { enkel: 1, dubbel: 2, svit: 3 };
	const maxCapacity = roomCapacities[roomType.toLowerCase()];

	if (!maxCapacity) {
		return {
			valid: false,
			message: `Unknown room type: ${roomType}`,
		};
	}

	const maxGuestsAllowed = maxCapacity * numberOfRooms;

	if (guestCount > maxGuestsAllowed) {
		return {
			valid: false,
			message: `Too many guests for ${roomType} room. Maximum capacity: ${maxGuestsAllowed}, requested: ${guestCount}`,
		};
	}

	return {
		valid: true,
		message: "Guest count is valid",
	};
}

async function updateBookedRooms(roomType, numberOfRooms) {
	await docClient.send(
		new UpdateCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `ROOM#${roomType.toUpperCase()}`,
				SK: "META",
			},
			UpdateExpression: "ADD #bookedRooms :increment",
			ExpressionAttributeNames: {
				"#bookedRooms": "BOOKED ROOMS",
			},
			ExpressionAttributeValues: {
				":increment": numberOfRooms,
			},
		})
	);
}

async function checkRoomAvailability(roomType, requestedRooms) {
	try {
	
		const roomResult = await docClient.send(
			new QueryCommand({
				TableName: TABLE_NAME,
				KeyConditionExpression: "PK = :pk AND SK = :sk",
				ExpressionAttributeValues: {
					":pk": `ROOM#${roomType.toUpperCase()}`,
					":sk": "META",
				},
			})
		);

		if (!roomResult.Items || roomResult.Items.length === 0) {
			return {
				available: false,
				message: `Room type ${roomType} not found`,
			};
		}

		const room = roomResult.Items[0];
		const totalRooms = room["TOTAL ROOMS"];

		const allBookingsResult = await docClient.send(
			new QueryCommand({
				TableName: TABLE_NAME,
				KeyConditionExpression: "PK = :pk",
				ExpressionAttributeValues: {
					":pk": "BOOKING#",
				},
			})
		);

		let currentlyBookedRooms = 0;
	
		if (allBookingsResult.Items) {
			const confirmedBookings = allBookingsResult.Items.filter(
				(booking) =>
					booking.status === "confirmed" &&
					Array.isArray(booking.roomTypes) && 
					booking.roomTypes.some((r) => r.type === roomType)
			);

			currentlyBookedRooms = confirmedBookings.reduce((total, booking) => {
				const matchingRoom = booking.roomTypes.find((r) => r.type === roomType);
				return total + (matchingRoom ? parseInt(matchingRoom.rooms || 0) : 0);
			}, 0);
		}

		if (currentlyBookedRooms + requestedRooms > totalRooms) {
			return {
				available: false,
				message: `Not enough rooms available. Requested: ${requestedRooms}, Currently booked: ${currentlyBookedRooms}, Total: ${totalRooms}, Available: ${
					totalRooms - currentlyBookedRooms
				}`,
			};
		}

		return {
			available: true,
			message: `Rooms available. Currently booked: ${currentlyBookedRooms}, Total: ${totalRooms}`,
		};
	} catch (error) {
		console.error("Error checking room availability:", error);
		return {
			available: false,
			message: "Error checking room availability",
		};

	}
}

export {
	calculateNights,
	validateGuestCapacity,
	checkRoomAvailability,
	calculateTotalPrice,
	updateBookedRooms,
};
