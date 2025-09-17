import { docClient } from "../../services/db.mjs";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event) => {
	try {
		const bookingId = event.pathParameters.bookingId;
		console.log("Received booking ID: ", bookingId);

		if (!bookingId) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: "Missing booking ID." }),
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
