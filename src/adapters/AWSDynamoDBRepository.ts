import {randomUUID} from 'node:crypto';
import type {AppointmentRecord, AppointmentRequest, CountryISO} from 'index';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {globalEnv} from "../config/env";

const dynamoDBClient = new DynamoDBClient({apiVersion: '2012-08-10'});


export class AWSDynamoDBRepository {
    private readonly documentClient: DynamoDBDocumentClient;
    private readonly tableName: string;

    constructor(client: DynamoDBClient = dynamoDBClient, tableName: string = globalEnv.APPOINTMENTS_TABLE) {
        this.documentClient = DynamoDBDocumentClient.from(client);
        this.tableName = tableName;
    }

    /**
     * Save an appointment request
     * @returns Promise<AppointmentRecord>
     * @param request
     */
    async saveAppointment(request: AppointmentRequest): Promise<AppointmentRecord | undefined> {
        const now = new Date().getTime().toString();
        const item = {
            id: randomUUID(),
            insuredId: request.insuredId,
            scheduleId: request.scheduleId,
            countryISO: request.countryISO,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        };

        const putItemCommand = new PutCommand({
            TableName: this.tableName,
            Item: item,
            ReturnValues: "NONE",
        });
        await this.documentClient.send(putItemCommand);
        return Promise.resolve(item as AppointmentRecord);
    }

    /**
     * Get all appointments for a given insuredId
     * @returns Promise<AppointmentRecord[]>
     * @param insuredId
     */
    async getByInsuredId(insuredId: string): Promise<AppointmentRecord[]> {
        const queryCommand = new QueryCommand({
            TableName: this.tableName,
            IndexName: 'insuredId-index',
            KeyConditionExpression: 'insuredId = :iid',
            ExpressionAttributeValues: {
                ":iid": insuredId
            },
        });
        const records = await this.documentClient.send(queryCommand);
        return records.Items as AppointmentRecord[];
    }

    /**
     * Updates appointment status to "completed"
     * @returns Promise<AppointmentRecord | undefined>
     * @param insuredId
     * @param scheduleId
     * @param countryISO
     */
    async updateAppointmentToCompleted(
        insuredId: string,
        scheduleId: number,
        countryISO: CountryISO,
    ): Promise<AppointmentRecord | undefined> {
        const items = await this.getByInsuredId(insuredId);
        const match = items.find(
            (it) => it.scheduleId === scheduleId && it.countryISO === countryISO && it.status === 'pending',
        );
        if (!match) return undefined;

        const updateItemCommand = new UpdateCommand({
            TableName: this.tableName,
            Key: {
                id: match.id
            },
            UpdateExpression: 'SET #s = :completed, updatedAt = :now',
            ConditionExpression: '#s = :pending',
            ExpressionAttributeNames: {
                '#s': 'status'
            },
            ExpressionAttributeValues: {
                ':pending': 'pending',
                ':completed': 'completed',
                ':now': new Date().getTime().toString()
            },
            ReturnValues: 'ALL_NEW',
        });
        const result = await this.documentClient.send(updateItemCommand);
        return result.Attributes as AppointmentRecord | undefined;
    }
}
