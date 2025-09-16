import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'; // Importera Document Client

const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'eu-north-1' 
});

// Skapa en DocumentClient som använder den vanliga DynamoDBClient
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'HotelBooking';

export {
    docClient, // Exportera docClient istället för client
    TABLE_NAME
};
