import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLE_NAME } from '../../services/db.mjs';

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        
        const requiredFields = ['guestName', 'guestEmail', 'guestCount', 'roomType', 'numberOfRooms', 'checkIn', 'checkOut'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        message: `Missing required field: ${field}`
                    })
                };
            }
        }

        const roomAvailability = await checkRoomAvailability(body.roomType, body.numberOfRooms);
        
        if (!roomAvailability.available) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
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
            createdAt: new Date().toISOString(),
            status: 'confirmed'
        };

        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: booking 
        });

        await docClient.send(command);

        await updateBookedRooms(body.roomType, body.numberOfRooms);

        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
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
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to create booking',
                error: error.message
            })
        };
    }
};

async function updateBookedRooms(roomType, numberOfRooms) {
    try {
        const updateCommand = new UpdateCommand({
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
        });

        await docClient.send(updateCommand);
        console.log(`Updated BOOKED ROOMS for ${roomType} by +${numberOfRooms}`);
        
    } catch (error) {
        console.error('Error updating booked rooms:', error);
        throw error;
    }
}

async function checkRoomAvailability(roomType, requestedRooms) {
    try {
        console.log('Checking availability for roomType:', roomType);
        
        const roomQuery = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND SK = :sk",
            ExpressionAttributeValues: {
                ":pk": `ROOM#${roomType.toUpperCase()}`,
                ":sk": "META"
            }
        });

        const roomResult = await docClient.send(roomQuery);
        
        if (!roomResult.Items || roomResult.Items.length === 0) {
            return {
                available: false,
                message: `Room type ${roomType} not found`
            };
        }

        const room = roomResult.Items[0];
        const totalRooms = room['TOTAL ROOMS'];

        const allBookingsQuery = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": "BOOKING#"
            }
        });

        const allBookingsResult = await docClient.send(allBookingsQuery);
        
        let currentlyBookedRooms = 0;
        if (allBookingsResult.Items) {
            const confirmedBookings = allBookingsResult.Items.filter(booking => 
                booking.roomType === roomType && booking.status === 'confirmed'
            );
            
            currentlyBookedRooms = confirmedBookings.reduce((total, booking) => {
                return total + parseInt(booking.numberOfRooms || 0);
            }, 0);
        }

        console.log(`Room type: ${roomType}, Total: ${totalRooms}, Currently booked: ${currentlyBookedRooms}, Requested: ${requestedRooms}`);

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
