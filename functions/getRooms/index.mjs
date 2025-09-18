import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../services/db.mjs';

export const handler=async(event)=>{
    try{
        const roomResult=await docClient.send(new GetCommand({
            TableName:TABLE_NAME,
            Key:{
                PK:"ROOM#${roomType.toUpperCase()}",
                SK:"META"
            },
        }));
        
        if(!roomResult.Item){
            return{
                success:false,
                message:`Room type ${roomType} not found`
            };
        }

        const room=roomResult.Item;
        const totalRooms=room["TOTAL ROOMS"];
        const bookedRooms=room["BOOKED ROOMS"]||0;
        const availableRooms=totalRooms-bookedRooms;

       return{
        success:true,
        roomType:roomType,
        totalRooms,
        bookedRooms,
        availableRooms:availableRooms<0 ? 0:availableRooms
       };
    } catch (error){
        console.error("error fetching room types:",error);
        return{
            success:false,
            message:"error fetching room availability",
            error: error.message,
        };
    }
};
    