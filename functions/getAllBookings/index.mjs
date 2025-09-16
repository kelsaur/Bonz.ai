import { client } from "../../services/db.mjs";
import { QueryCommand } from "@aws-sdk/client-dynamodb";

export const handler = async (event) => {
	try {
		const command = new QueryCommand({
			TableName: "HotelBooking",
			KeyConditionExpression: "pk = :pk", //placeholders
			ExpressionAttributeValues: {
				//define placeholders
				":pk": { S: `BOOKING#` },
			},
		});

		const result = await client.send(command);

		//!!! const bookings = bookingid, no of rooms, no of guests, room type(s),
		//!!! checkin, checkout, name

		if (bookings.length === 0) {
			return {
				statusCode: 200,
				body: JSON.stringify("There are currently no bookings."),
			};
		}

		return {
			statusCode: 200,
			body: JSON.stringify({ bookings }),
		};
	} catch (error) {
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch bookings." }),
		};
	}
};
