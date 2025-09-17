import { docClient } from "../../services/db.mjs";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event) => {
	try {
		const bookingId = event.pathParameters.bookingId;
		console.log("Received booking ID: ", bookingId);

		const isUuid =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		const formatDate = (dateStr) =>
			new Date(dateStr).toLocaleDateString("en-GB");
		const headers = {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		};

		if (!bookingId) {
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ message: "Missing booking ID." }),
			};
		}

		if (!isUuid.test(bookingId)) {
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ message: "Invalid booking ID format." }),
			};
		}

		const command = new GetCommand({
			TableName: "HotelBooking",
			Key: {
				PK: `BOOKING#`,
				SK: `ID#${bookingId}`,
			},
		});

		const result = await docClient.send(command);
		console.log("Fetched result: ", result);

		if (!result.Item) {
			return {
				statusCode: 404,
				headers,
				body: JSON.stringify({ message: "There is no such booking." }),
			};
		}

		return {
			headers,
			statusCode: 200,
			body: JSON.stringify({
				booking: {
					"Booking ID": result.Item.bookingId,
					"Guest Name": result.Item.guestName,
					"Guest Email": result.Item.guestEmail,
					"Number Of Rooms": result.Item.totalNumberOfRooms,
					"Number Of Guests": result.Item.guestCount,
					"Room Types": result.Item.roomTypes,
					"Check In": formatDate(result.Item.checkIn),
					"Check Out": formatDate(result.Item.checkOut),
					"Booking Status": result.Item.status,
					"Created At": formatDate(result.Item.createdAt),
				},
			}),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({ error: "Failed to fetch this booking." }),
		};
	}
};
