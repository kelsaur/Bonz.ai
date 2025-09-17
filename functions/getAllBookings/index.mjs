import { docClient } from "../../services/db.mjs";
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

		const result = await docClient.send(command);
		const totalBookings = result.Count;

		const bookings = result.Items.map((item) => ({
			bookingId: item.bookingId.S,
			guestName: item.guestName.S,
			checkIn: item.checkIn.S,
			checkOut: item.checkOut.S,
			guestCount: parseInt(item.guestCount.N),
			roomType: JSON.parse(item.roomType.S),
			totalPrice: parseInt(item.totalPrice.N),
		}));

		if (bookings.length === 0) {
			return {
				statusCode: 200,
				body: JSON.stringify({ message: "There are currently no bookings." }),
			};
		}

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: `There are currently ${totalBookings} bookings in total: `,
				bookings,
			}),
		};
	} catch (error) {
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch bookings." }),
		};
	}
};
