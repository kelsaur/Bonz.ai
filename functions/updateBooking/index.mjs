import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../services/db.mjs';

const CORS_HEADERS={
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*'
};

export const handler = async (event) => {
    try {
        const body=JSON.parse(event.body);

        if (!body.bookingId){
            return {
                statusCode:400,
                headers:CORS_HEADERS,
                body: JSON.stringify({
                    success:false,
                    message:"Missing required field:bookingId"
                }),
            };
        }

        const bookingId=body.bookingId;

        // get the old boiking details by bookingId
        const oldBookingResult=await docClient.send(new GetCommand({
            TableName:TABLE_NAME,
            Key:{
                PK:"BOOKING#",
                SK:`ID#${bookingId}`
            },
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
                }),
            };
        }

        const oldBooking=oldBookingResult.Item;

        // prepare new booking details
        const newRoomTypes=body.roomTypes || oldBooking.roomTypes;
        const newGuests=body.guestCount || oldBooking.guestCount;


        // validate each new room type against capacity and availability
        for (const newRoom of newRoomTypes){
            const roomResult=await docClient.send(new GetCommand({
                TableName:TABLE_NAME,
                Key:{
                    PK:`ROOM#${newRoom.type.toUpperCase()}`,
                    SK:"META"
                },
            }));

            if (!roomResult.Item){
                return{
                    statusCode:400,
                    headers:CORS_HEADERS,
                    body:JSON.stringify({
                        success:false,
                        message:`Invalid room type: ${newRoom.type}`
                    }),
                };
            }

            const roomItem=roomResult.Item;

            // check if capacity
            if (newRoom.guests>newRoom.rooms*roomItem.capacity){
                return{
                    statusCode:400,
                    headers:CORS_HEADERS,
                    body:JSON.stringify({
                        success:false,
                        message:`Guest number ${newRoom.guests} exceeds capacity for ${newRoom.rooms} ${newRoom.type} room(s)`
                    }),
                };
            }

            // availability check
            const oldRoom=oldBooking.roomTypes.find((r)=>r.type===newRoom.type);
            const oldRooms=oldRoom ? oldRoom.rooms :0;
            const deltaRooms=newRoom.rooms-oldRooms;

            const projectedBooked=roomItem['BOOKED ROOMS']+deltaRooms;
            if (projectedBooked<0 || projectedBooked>roomItem['TOTAL ROOMS'])
                return{
                    statusCode:400,
                    headers:CORS_HEADERS,
                    body:JSON.stringify({
                        success:false,
                        message:`Not enough ${newRoom.type} rooms available`
                    }),
                };
            }
        
        // UPDATE BOOKING ITEM
       let updateExpression='SET ';
       const expressionAttributeNames={};
       const expressionAttributeValues={};
       let prefix='';

       const updatableFields=['guestName','guestEmail','guestCount','roomTypes','checkIn','checkOut','status'];

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
        

        // update bookedRooms counters
        for (const oldRoom of oldBooking.roomTypes){
            const newRoom=newRoomTypes.find((r)=>r.type===oldRoom.type);
            const newRooms=newRoom ? newRoom.rooms :0;
            const deltaRooms=newRooms-oldRoom.rooms;

            if (deltaRooms!==0){
                await docClient.send(new UpdateCommand({
                    TableName:TABLE_NAME,
                    Key:{
                        PK:`ROOM#${oldRoom.type.toUpperCase()}`,
                        SK:"META"
                    },
                    UpdateExpression:"SET #bookedRooms=#bookedRooms+:num",
                    ExpressionAttributeNames:{
                        "#bookedRooms":"BOOKED ROOMS",
                        "#totalRooms": "TOTAL ROOMS",
                    },
                    ExpressionAttributeValues:{
                        ":num":deltaRooms,
                        ":zero":0,
                    },
                }));
            }
        }

        // handle any new room types added in the update
        for (const newRoom of newRoomTypes){
            const oldRoom=oldBooking.roomTypes.find((r)=>r.type===newRoom.type);
            if (!oldRoom){
                await docClient.send(new UpdateCommand({
                    TableName:TABLE_NAME,
                    Key:{
                        PK:`ROOM#${newRoom.type.toUpperCase()}`,
                        SK:"META"
                    },
                    UpdateExpression:"SET #bookedRooms=#bookedRooms+:num",
                    ExpressionAttributeNames:{
                        "#bookedRooms":"BOOKED ROOMS",
                        "#totalRooms": "TOTAL ROOMS",
                    },
                    ExpressionAttributeValues:{
                        ":num":newRoom.rooms,
                        ":zero":0,
                    },
                }));
            }
        }
  
        // return results
        return{
            statusCode:200,
            headers:CORS_HEADERS,
            body:JSON.stringify({
                success:true,
                message:"Booking updated successfully",
                booking:updatedBooking.Attributes
            }),
        };
    } catch (error){
        console.error("Error updating booking:",error);
        return{
            statusCode:500,
            headers:CORS_HEADERS,
            body:JSON.stringify({
                success:false,
                message:"Error updating booking",
            error: error.message
            }),
        };
    }
};