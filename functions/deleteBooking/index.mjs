import { DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../services/db.mjs';

export const handler = async (event) => {
    try {
        const bookingId = event.pathParameters?.bookingId;
        
        if (!bookingId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Booking ID is required'
                })
            };
        }

        const getCommand = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: "BOOKING#",
                SK: `ID#${bookingId}`
            }
        });

        const getResult = await docClient.send(getCommand);
        
        if (!getResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Booking not found'
                })
            };
        }

        const booking = getResult.Item;
        const roomType = booking.roomType;
        const numberOfRooms = booking.numberOfRooms;

        const deleteCommand = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: "BOOKING#",
                SK: `ID#${bookingId}`
            }
        });

        await docClient.send(deleteCommand);

        await decreaseBookedRooms(roomType, numberOfRooms);

        const deletedBooking = getResult.Item;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Booking deleted successfully',
                deletedBooking: deletedBooking
            })
        };

    } catch (error) {
        console.error('Error deleting booking:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to delete booking',
                error: error.message
            })
        };
    }
};

async function decreaseBookedRooms(roomType, numberOfRooms) {
    try {
        const updateCommand = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `ROOM#${roomType.toUpperCase()}`,
                SK: "META"
            },
            UpdateExpression: "ADD #bookedRooms :decrement",
            ExpressionAttributeNames: {
                "#bookedRooms": "BOOKED ROOMS"
            },
            ExpressionAttributeValues: {
                ":decrement": -numberOfRooms
            }
        });

        await docClient.send(updateCommand);
        console.log(`Decreased BOOKED ROOMS for ${roomType} by -${numberOfRooms}`);
        
    } catch (error) {
        console.error('Error decreasing booked rooms:', error);
        throw error;
    }
}
