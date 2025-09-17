import { docClient } from "../../services/db.mjs";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const getBookingById = async (event) => {
	try {
		const bookingId = event.pathParameters.id;

		if (!bookingId) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: "Missing booking ID." }),
			};
		}

		const command = new GetCommand({
			TableName: "HotelBooking",
			Key: {
				pk: { S: `BOOKING#` },
				sk: { S: `ID${bookingId}` },
			},
		});

		const result = await docClient.send(command);

		if (!result.Item) {
			return {
				statusCode: 404,
				body: JSON.stringify({ message: "There is no such booking." }),
			};
		}

		return {
			statusCode: 200,
			body: JSON.stringify({
				booking: result.Item,
			}),
		};
	} catch (error) {
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch this booking." }),
		};
	}
};
