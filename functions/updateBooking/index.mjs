import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../../services/db.mjs";
import {
	calculateTotalPrice,
	calculateNights,
	validateGuestCapacity,
	checkRoomAvailability,
	updateBookedRooms,
} from "../createBooking/index.mjs";

const CORS_HEADERS = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*",
};

export const handler = async (event) => {
	try {
		const body = JSON.parse(event.body);
		const bookingId = event.pathParameters?.bookingId;

		if (!bookingId) {
			return {
				statusCode: 400,
				headers: CORS_HEADERS,
				body: JSON.stringify({
					success: false,
					message: "Missing bookingId in URL path.",
				}),
			};
		}

		//current booking
		const oldBookingResult = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: "BOOKING#",
					SK: `ID#${bookingId}`,
				},
			})
		);

		if (!oldBookingResult.Item) {
			return {
				statusCode: 404,
				headers: CORS_HEADERS,
				body: JSON.stringify({
					success: false,
					message: "Booking not found",
				}),
			};
		}

		const oldBooking = oldBookingResult.Item;

		let updates = [];
		let names = {};
		let values = {};

		//guest count update
		if (body.guestCount) {
			names["#guestCount"] = "guestCount";
			values[":guestCount"] = body.guestCount;
			updates.push("#guestCount = :guestCount");
		}

		//check-in update
		const checkIn = body.checkIn || oldBooking.checkIn;
		if (body.checkIn) {
			names["#checkIn"] = "checkIn";
			values[":checkIn"] = body.checkIn;
			updates.push("#checkIn = :checkIn");
		}

		//check-out update
		const checkOut = body.checkOut || oldBooking.checkOut;
		if (body.checkOut) {
			names["#checkOut"] = "checkOut";
			values[":checkOut"] = body.checkOut;
			updates.push("#checkOut = :checkOut");
		}

		//room types update
		const newRoomTypes = body.roomTypes;
		const updateRooms = Array.isArray(newRoomTypes);

		if (updateRooms) {
			for (const newRoom of newRoomTypes) {
				const { valid, message } = validateGuestCapacity(
					newRoom.type,
					newRoom.guests,
					newRoom.rooms
				);
				if (!valid) {
					return {
						statusCode: 400,
						headers: CORS_HEADERS,
						body: JSON.stringify({ success: false, message }),
					};
				}

				const availability = await checkRoomAvailability(
					newRoom.type,
					newRoom.rooms
				);
				if (!availability.available) {
					return {
						statusCode: 400,
						headers: CORS_HEADERS,
						body: JSON.stringify({
							success: false,
							message: availability.message,
						}),
					};
				}
			}

			for (const oldRoom of oldBooking.roomTypes) {
				const newRoom = newRoomTypes.find((r) => r.type === oldRoom.type);
				const newRooms = newRoom ? newRoom.rooms : 0;
				const deltaRooms = newRooms - oldRoom.rooms;
				if (deltaRooms !== 0) {
					await updateBookedRooms(oldRoom.type, deltaRooms);
				}
			}

			for (const newRoom of newRoomTypes) {
				const oldRoom = oldBooking.roomTypes.find(
					(r) => r.type === newRoom.type
				);
				if (!oldRoom) {
					await updateBookedRooms(newRoom.type, newRoom.rooms);
				}
			}

			names["#roomTypes"] = "roomTypes";
			values[":roomTypes"] = newRoomTypes;
			updates.push("#roomTypes = :roomTypes");
		}

		//rcalculate totalPrice and nights if dates or rooms changed
		if (checkIn && checkOut) {
			const finalRoomTypes = newRoomTypes || oldBooking.roomTypes;
			const nights = calculateNights(checkIn, checkOut);
			const totalPrice = calculateTotalPrice(finalRoomTypes, checkIn, checkOut);

			names["#nights"] = "nights";
			values[":nights"] = nights;
			updates.push("#nights = :nights");

			names["#totalPrice"] = "totalPrice";
			values[":totalPrice"] = totalPrice;
			updates.push("#totalPrice = :totalPrice");
		}

		names["#updatedAt"] = "updatedAt";
		values[":updatedAt"] = new Date().toISOString();
		updates.push("#updatedAt = :updatedAt");

		const updateExpression = `SET ${updates.join(", ")}`;

		const updatedBooking = await docClient.send(
			new UpdateCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: "BOOKING#",
					SK: `ID#${bookingId}`,
				},
				UpdateExpression: updateExpression,
				ExpressionAttributeNames: names,
				ExpressionAttributeValues: values,
				ReturnValues: "ALL_NEW",
			})
		);

		return {
			statusCode: 200,
			headers: CORS_HEADERS,
			body: JSON.stringify({
				success: true,
				message: "Booking updated successfully",
				booking: updatedBooking.Attributes,
			}),
		};
	} catch (error) {
		console.error("Error updating booking:", error);
		return {
			statusCode: 500,
			headers: CORS_HEADERS,
			body: JSON.stringify({
				success: false,
				message: "Error updating booking",
				error: error.message,
			}),
		};
	}
};
