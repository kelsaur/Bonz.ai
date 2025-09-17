import { PutCommand } from '@aws-sdk/lib-dynamodb';
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