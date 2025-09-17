import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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
                PK: bookingId,
                SK: `BOOKING#${bookingId}`
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

        const deleteCommand = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: bookingId,
                SK: `BOOKING#${bookingId}`
            }
        });

        await docClient.send(deleteCommand);

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