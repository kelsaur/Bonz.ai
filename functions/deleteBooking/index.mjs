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
        const guestCount = booking.guestCount;

        const guestValidation = validateGuestCapacity(roomType, guestCount);
        if (!guestValidation.valid) {
            console.warn(`Deleting invalid booking: ${guestValidation.message}`);
        }

        const deleteCommand = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: "BOOKING#",
                SK: `ID#${bookingId}`
            }
        });

        await docClient.send(deleteCommand);

        await decreaseBookedRooms(roomType, numberOfRooms);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Booking deleted successfully',
                deletedBooking: booking,
                guestValidation: guestValidation.valid ? 'Valid booking' : `Invalid booking: ${guestValidation.message}`
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

function validateGuestCapacity(roomType, guestCount) {
    const roomCapacities = {
        'enkel': 1,
        'dubbel': 2,
        'svit': 3
    };

    const maxCapacity = roomCapacities[roomType.toLowerCase()];
    
    if (!maxCapacity) {
        return {
            valid: false,
            message: `Unknown room type: ${roomType}`
        };
    }

    if (guestCount > maxCapacity) {
        return {
            valid: false,
            message: `Too many guests for ${roomType} room. Maximum capacity: ${maxCapacity}, actual: ${guestCount}`
        };
    }

    return {
        valid: true,
        message: 'Guest count is valid'
    };
}

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
