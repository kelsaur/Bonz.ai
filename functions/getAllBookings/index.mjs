import { docClient } from "../../services/db.mjs";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event) => {
	try {
		const formatDate = (dateStr) =>
			new Date(dateStr).toLocaleDateString("en-GB");
		const headers = {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		};

		const command = new QueryCommand({
			TableName: "HotelBooking",
			KeyConditionExpression: "PK = :PK",
			ExpressionAttributeValues: {
				":PK": "BOOKING#",
			},
		});

		const result = await docClient.send(command);
		const bookingsData = result.Items || []; //in case of no bookings returns empty array instead of undefined
		const totalBookings = result.Count ?? bookingsData.length;

		if (bookingsData.length === 0) {
			return {
				statusCode: 200,
				headers,
				body: JSON.stringify({ message: "There are currently no bookings." }),
			};
		}

		const bookings = bookingsData.map((item) => ({
			"Booking ID": item.bookingId,
			"Guest Name": item.guestName,
			"Guest Email": item.guestEmail,
			"Number Of Rooms": item.numberOfRooms,
			"Number Of Guests": item.guestCount,
			"Room Type": item.roomType,
			"Check In": formatDate(item.checkIn),
			"Check Out": formatDate(item.checkOut),
			"Booking Status": item.status,
			"Created At": formatDate(item.createdAt),
		}));

		return {
			statusCode: 200,
			headers,
			body: JSON.stringify({
				message: `There are currently ${totalBookings} bookings in total: `,
				bookings,
			}),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({ error: "Failed to fetch bookings." }),
		};
	}
};
