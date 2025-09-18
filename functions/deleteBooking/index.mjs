import {
	DeleteCommand,
	GetCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../../services/db.mjs";

const CORS_HEADERS = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*",
};

export const handler = async (event) => {
	try {
		const bookingId = event.pathParameters?.bookingId;

		if (!bookingId) {
			return {
				statusCode: 400,
				headers: CORS_HEADERS,
				body: JSON.stringify({
					success: false,
					message: "Booking ID is required",
				}),
			};
		}

		const getResult = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: "BOOKING#",
					SK: `ID#${bookingId}`,
				},
			})
		);

		if (!getResult.Item) {
			return {
				statusCode: 404,
				headers: CORS_HEADERS,
				body: JSON.stringify({
					success: false,
					message: "Booking not found",
				}),
			};
		}

		const booking = getResult.Item;

		//decrease for each room in roomTypes array
		if (Array.isArray(booking.roomTypes)) {
			for (const room of booking.roomTypes) {
				await decreaseBookedRooms(room.type, room.rooms);
			}
		}

		await docClient.send(
			new DeleteCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: "BOOKING#",
					SK: `ID#${bookingId}`,
				},
			})
		);

		return {
			statusCode: 200,
			headers: CORS_HEADERS,
			body: JSON.stringify({
				success: true,
				message: "Booking deleted successfully",
				deletedBooking: booking,
			}),
		};
	} catch (error) {
		console.error("Error deleting booking:", error);

		return {
			statusCode: 500,
			headers: CORS_HEADERS,
			body: JSON.stringify({
				success: false,
				message: "Failed to delete booking",
				error: error.message,
			}),
		};
	}
};

async function decreaseBookedRooms(roomType, numberOfRooms) {
	await docClient.send(
		new UpdateCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `ROOM#${roomType.toUpperCase()}`,
				SK: "META",
			},
			UpdateExpression: "ADD #bookedRooms :decrement",
			ExpressionAttributeNames: {
				"#bookedRooms": "BOOKED ROOMS",
			},
			ExpressionAttributeValues: {
				":decrement": -numberOfRooms,
			},
		})
	);
	console.log(`Decreased BOOKED ROOMS for ${roomType} by -${numberOfRooms}`);
}
