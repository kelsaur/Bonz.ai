import { docClient } from "../../services/db.mjs";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event) => {
	try {
		const command = new QueryCommand({
			TableName: "HotelBooking",
			KeyConditionExpression: "PK = :PK",
			ExpressionAttributeValues: {
				":PK": "BOOKING#",
			},
		});

		const result = await docClient.send(command);
		const totalBookings = result.Count;

		const bookings = result.Items.map((item) => ({
			bookingId: item.bookingId,
			guestName: item.guestName,
			checkIn: item.checkIn,
			checkOut: item.checkOut,
			guestCount: parseInt(item.guestCount),
			roomType: item.roomType,
			totalPrice: parseInt(item.totalPrice),
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
