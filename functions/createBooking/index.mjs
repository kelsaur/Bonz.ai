import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid'; // Se till att uuid är installerat och importerat
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

        const bookingId = uuidv4();
        
        const booking = {
            PK: bookingId,
            SK: `BOOKING#${bookingId}`,
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

        // NYTT: Logga objektet innan det skickas till DynamoDB
        console.log('Attempting to put item into DynamoDB:', JSON.stringify(booking, null, 2));

        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: booking
        });

        await docClient.send(command);

        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Booking created successfully',
                booking: {
                    bookingId: bookingId,
                    ...booking
                }
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