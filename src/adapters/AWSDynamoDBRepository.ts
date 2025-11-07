import {randomUUID} from 'node:crypto';
import type {AppointmentRecord, AppointmentRequest, CountryISO} from 'index';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {getGlobalEnv} from "../config/env";
import Logger from '../config/winston';

const dynamoDBClient = new DynamoDBClient({apiVersion: '2012-08-10'});


export class AWSDynamoDBRepository {
    private readonly documentClient: DynamoDBDocumentClient;
    private readonly tableName: string;

    constructor(client: DynamoDBClient = dynamoDBClient) {
        this.documentClient = DynamoDBDocumentClient.from(client);
        this.tableName = getGlobalEnv("APPOINTMENTS_TABLE");
    }

    /**
     * Save an appointment request
     * @returns Promise<AppointmentRecord>
     * @param request
     */
    async saveAppointment(request: AppointmentRequest): Promise<AppointmentRecord> {
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

        try {
            const putItemCommand = new PutCommand({
                TableName: this.tableName,
                Item: item,
                ReturnValues: "NONE",
            });
            Logger.debug(`Saving appointment: ${JSON.stringify(item)}`);
            await this.documentClient.send(putItemCommand);
            Logger.info("Appointment saved successfully.")
            return Promise.resolve(item as AppointmentRecord);
        } catch (e: unknown) {
            Logger.error(`Failed to save appointment: ${JSON.stringify(item)}`);
            throw new Error(`Failed to save appointment`);
        }
    }

    /**
     * Get all appointments for a given insuredId
     * @returns Promise<AppointmentRecord[]>
     * @param insuredId
     */
    async getByInsuredId(insuredId: string): Promise<AppointmentRecord[]> {
        try {
            const queryCommand = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'insuredId-index',
                KeyConditionExpression: 'insuredId = :iid',
                ExpressionAttributeValues: {
                    ":iid": insuredId
                },
            });
            Logger.info(`Querying appointments for insuredId: ${insuredId}`);
            const records = await this.documentClient.send(queryCommand);
            return records.Items as AppointmentRecord[];
        } catch (e: unknown) {
            Logger.error(`Failed to get appointments for insuredId: ${insuredId}`);
            throw new Error(`Failed to get appointments for insuredId [${insuredId}]`);
        }
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
        Logger.debug(`Getting appointment for insuredId: [${insuredId}]`);
        const items = await this.getByInsuredId(insuredId);
        const match = items.find(
            (it) => it.scheduleId === scheduleId && it.countryISO === countryISO && it.status === 'pending',
        );
        if (!match) {
            Logger.info(`No pending appointment found for insuredId: [${insuredId}]`);
            return undefined;
        }

        try {
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
            Logger.debug(`Updating appointment status to completed for insuredId: [${insuredId}]`);
            const result = await this.documentClient.send(updateItemCommand);
            return result.Attributes as AppointmentRecord | undefined;
        } catch (e: unknown) {
            Logger.error(`Failed to update appointment status for insuredId: [${insuredId}]`);
            throw new Error(`Failed to update appointment status`);
        }
    }
}
