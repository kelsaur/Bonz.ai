import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../services/db.mjs';

export const handler = async (event) => {
    try {
        const body=JSON.parse(event.body);

        if (!body.bookingId){
            return {
                statusCode:400,
                headers:{
                    'Content-Type':'application/json',
                    'Access-Control-Allow-Origin':'*'
                }, body: JSON.stringify({
                    success:false,
                    message:"Missing required field:bookingId"
                })
            };
        }

        const bookingId=body.bookingId;

        // get the old boiking details by bookingId
        const oldBookingResult=await docClient.send(new GetCommand({
            TableName:TABLE_NAME,
            Key:{
                PK:"BOOKING#",
                SK:`ID#${bookingId}`
            }
        }));

        // if booking not found
        if (!oldBookingResult.Item){
            return{
                statusCode:404,
                headers:{
                    'Content-Type':'application/json',
                    'Access-Control-Allow-Origin':'*'
                },body:JSON.stringify({
                    success:false,
                    message:"Booking not found"
                })
            };
        }

        const oldBooking=oldBookingResult.Item;

        // prepare new booking values
        const newRoomType=body.roomType || oldBooking.roomType;
        const newRooms=body.numberOfRooms !== undefined ? body.numberOfRooms:oldBooking.numberOfRooms;
        const newGuests=body.guestCount || oldBooking.guestCount;

        // get room item using PK
        const roomPk=`ROOM#${newRoomType.toUpperCase()}`;
        const roomResult=await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key:{
                PK:roomPk, SK: "META"
            }
        }));

        // if room not found
        if (!roomResult.Item){
            return{
                statusCode: 400,
                headers:{
                    'Content-Type':'application/json',
                    'Access-Control-Allow-Origin':'*'
                },body:JSON.stringify({
                    success:false,
                    message:"Invalid room type"
                })
            };
        }

        const roomItem=roomResult.Item;

        // check if enough rooms are available
        if (newGuests >newRooms * roomItem.capacity){
            return{
                statusCode:400,
                 headers:{
                    'Content-Type':'application/json',
                    'Access-Control-Allow-Origin':'*'
                },body:JSON.stringify({
                    success:false,
                    message:`Guest number ${newGuests} exceeds capacity for ${newRooms} ${newRoomType} room(s)`
                })
            };
        }

        // Room AVAILABILITY VALIDATION 
        let deltaRooms=0;
        if (newRoomType === oldBooking.roomType){
            deltaRooms=newRooms - oldBooking.numberOfRooms;
        } else{
            deltaRooms=newRooms; 
            // change room type to new room type
        }

        const projectedBooked=roomItem.roomBooked+deltaRooms;
        if (projectedBooked > roomItem.totalRooms){
            return{
                statusCode:400,
                headers:{
                    'Content-Type':'application/json',
                    'Access-Control-Allow-Origin':'*'
                },body:JSON.stringify({
                    success:false,
                    message:`Not enough ${newRoomType} rooms available`
                })
            };
        }

        // update booking item
        let updateExpression='SET ';
        const expressionAttributeNames={};
        const expressionAttributeValues={};
        let prefix='';

        const updatableFields=['guestName','guestEmail','guestCount','roomType','numberOfRooms','checkIn','checkOut','status'];

        updatableFields.forEach(field=>{
            if(body[field]!==undefined){
                updateExpression+=`${prefix}#${field}=:${field}`;
                expressionAttributeNames[`#${field}`]=field;
                expressionAttributeValues[`:${field}`]=body[field];
                prefix=', ';
            }
        });

        // update updatedAt field
        updateExpression+=`${prefix}#updatedAt=:updatedAt`;
        expressionAttributeNames['#updatedAt']='updatedAt';
        expressionAttributeValues[':updatedAt']=new Date().toISOString();

        // update the booking
        const updatedBooking=await docClient.send(new UpdateCommand({
            TableName:TABLE_NAME,
            Key:{
                PK:"BOOKING#",
                SK:`ID#${bookingId}`
            },
            UpdateExpression:updateExpression,
            ExpressionAttributeNames:expressionAttributeNames,
            ExpressionAttributeValues:expressionAttributeValues,
            ReturnValues:"ALL_NEW"
        }))
        

        // update roomBooked counters
        if (oldBooking.roomType !==newRoomType){
            // decrement old room type booked counter
            await docClient.send(new UpdateCommand({
                TableName:TABLE_NAME,
                Key:{
                    PK:`ROOM#${oldBooking.roomType.toUpperCase()}`,
                    SK:"META"
                },
                UpdateExpression: "SET #roomBooked = #roomBooked - :num",
                ExpressionAttributeNames:{
                    "#roomBooked": "BOOKED ROOMS"
                },               
                ExpressionAttributeValues:{
                    ":num":oldBooking.numberOfRooms
                }
            }));

            // increment new room type booked counter
            await docClient.send(new UpdateCommand({
                TableName:TABLE_NAME,
                Key:{
                    PK:`ROOM#${newRoomType.toUpperCase()}`,
                    SK: "META"
                },
                UpdateExpression:"SET #roomBooked=#roomBooked+:num",
                ExpressionAttributeNames:{
                    "#roomBooked":"BOOKED ROOMS"
                },
                ExpressionAttributeValues:{
                    ":num": newRooms
                }
            }));
        } else if (deltaRooms !==0){
            // same type of rooms, just update the counter
            await docClient.send (new UpdateCommand({
                TableName:TABLE_NAME,
                Key:{
                    PK: `ROOM#${newRoomType.toUpperCase()}`,
                    SK: "META"
                },
                UpdateExpression:"SET #roomBooked=#roomBooked+:num",
                ExpressionAttributeNames:{
                    "#roomBooked":"BOOKED ROOMS"
                },
                ExpressionAttributeValues:{
                    ":num":deltaRooms
                }
            }));
        }

        // return results
        return{
            statusCode:200,
            headers:{
                'Content-Type':'application/json',
                'Access-Control-Allow-Origin':'*'
            }, body:JSON.stringify({
            success:true,
            message:"Booking updated successfully",
            booking:updatedBooking.Attributes
        })
    };
} catch (error){
    console.error("Error updating booking:",error);
    return{
        statusCode:500,
        headers:{
            'Content-Type':'application/json',
            'Access-Control-Allow-Origin':'*'
        },body:JSON.stringify({
            success:false,
            message:"Error updating booking",
            error: error.message
        })
    };
}
};