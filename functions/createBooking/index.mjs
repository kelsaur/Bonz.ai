import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLE_NAME } from '../../services/db.mjs';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
};

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        
        // Validera required fields
        const requiredFields = ['guestName', 'guestEmail', 'guestCount', 'roomType', 'numberOfRooms', 'checkIn', 'checkOut'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return {
                    statusCode: 400,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: false,
                        message: `Missing required field: ${field}`
                    })
                };
            }
        }

        const guestValidation = validateGuestCapacity(body.roomType, body.guestCount);
        if (!guestValidation.valid) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: false,
                    message: guestValidation.message
                })
            };
        }

        const totalPrice = calculateTotalPrice(body.roomType, body.numberOfRooms, body.checkIn, body.checkOut);
        const roomAvailability = await checkRoomAvailability(body.roomType, body.numberOfRooms);
        
        if (!roomAvailability.available) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: false,
                    message: roomAvailability.message
                })
            };
        }

        const bookingId = uuidv4();
        const booking = {
            PK: "BOOKING#",
            SK: `ID#${bookingId}`,
            guestName: body.guestName,
            guestEmail: body.guestEmail,
            guestCount: body.guestCount,
            roomType: body.roomType,
            numberOfRooms: body.numberOfRooms,
            checkIn: body.checkIn,
            checkOut: body.checkOut,
            totalPrice: totalPrice,
            createdAt: new Date().toISOString(),
            status: 'confirmed'
        };

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: booking 
        }));

        await updateBookedRooms(body.roomType, body.numberOfRooms);

        return {
            statusCode: 201,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                message: 'Booking created successfully',
                booking: booking
            })
        };

    } catch (error) {
        console.error('Error creating booking:', error);
        
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: false,
                message: 'Failed to create booking',
                error: error.message
            })
        };
    }
};

function calculateTotalPrice(roomType, numberOfRooms, checkIn, checkOut) {
    const roomPrices = { 'enkel': 500, 'dubbel': 1000, 'svit': 1500 };
    const pricePerNight = roomPrices[roomType.toLowerCase()];
    
    if (!pricePerNight) {
        throw new Error(`Unknown room type: ${roomType}`);
    }
    
    const nights = calculateNights(checkIn, checkOut);
    
    if (nights <= 0) {
        throw new Error('Invalid date range: checkout must be after checkin');
    }
    
    return pricePerNight * numberOfRooms * nights;
}

// Behåll denna för kompatibilitet med andra funktioner
function calculateNights(checkIn, checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const timeDifference = checkOutDate.getTime() - checkInDate.getTime();
    return Math.ceil(timeDifference / (1000 * 3600 * 24));
}

function validateGuestCapacity(roomType, guestCount) {
    const roomCapacities = { 'enkel': 1, 'dubbel': 2, 'svit': 3 };
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
            message: `Too many guests for ${roomType} room. Maximum capacity: ${maxCapacity}, requested: ${guestCount}`
        };
    }

    return {
        valid: true,
        message: 'Guest count is valid'
    };
}

async function updateBookedRooms(roomType, numberOfRooms) {
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `ROOM#${roomType.toUpperCase()}`,
            SK: "META"
        },
        UpdateExpression: "ADD #bookedRooms :increment",
        ExpressionAttributeNames: {
            "#bookedRooms": "BOOKED ROOMS"
        },
        ExpressionAttributeValues: {
            ":increment": numberOfRooms
        }
    }));
}

async function checkRoomAvailability(roomType, requestedRooms) {
    try {
        const roomResult = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND SK = :sk",
            ExpressionAttributeValues: {
                ":pk": `ROOM#${roomType.toUpperCase()}`,
                ":sk": "META"
            }
        }));
        
        if (!roomResult.Items || roomResult.Items.length === 0) {
            return {
                available: false,
                message: `Room type ${roomType} not found`
            };
        }

        const room = roomResult.Items[0];
        const totalRooms = room['TOTAL ROOMS'];

        const allBookingsResult = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": "BOOKING#"
            }
        }));
        
        let currentlyBookedRooms = 0;
        if (allBookingsResult.Items) {
            const confirmedBookings = allBookingsResult.Items.filter(booking => 
                booking.roomType === roomType && booking.status === 'confirmed'
            );
            
            currentlyBookedRooms = confirmedBookings.reduce((total, booking) => {
                return total + parseInt(booking.numberOfRooms || 0);
            }, 0);
        }

        if (currentlyBookedRooms + requestedRooms > totalRooms) {
            return {
                available: false,
                message: `Not enough rooms available. Requested: ${requestedRooms}, Currently booked: ${currentlyBookedRooms}, Total: ${totalRooms}, Available: ${totalRooms - currentlyBookedRooms}`
            };
        }

        return {
            available: true,
            message: `Rooms available. Currently booked: ${currentlyBookedRooms}, Total: ${totalRooms}`
        };

    } catch (error) {
        console.error('Error checking room availability:', error);
        return {
            available: false,
            message: 'Error checking room availability'
        };
    }
}
