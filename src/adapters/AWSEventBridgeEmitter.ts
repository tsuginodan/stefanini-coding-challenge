import {EventBridgeClient, PutEventsCommand} from '@aws-sdk/client-eventbridge';
import type {AppointmentProcessedEventMessage} from 'index';
import Logger from '../config/winston';

const awsEB = new EventBridgeClient({apiVersion: '2015-10-07'});


export class AWSEventBridgeEmitter {
    private readonly client: EventBridgeClient;

    constructor(client: EventBridgeClient = awsEB) {
        this.client = client;
    }

    async emitProcessed(message: AppointmentProcessedEventMessage): Promise<void> {
        const putEventsCommand = new PutEventsCommand({
            Entries: [
                {
                    Source: 'appointment',
                    DetailType: 'AppointmentProcessed',
                    Detail: JSON.stringify(message),
                },
            ],
        });
        Logger.debug(`Emitting processed event: ${JSON.stringify(message)}`);
        await this.client.send(putEventsCommand);
        Logger.info("AppointmentProcessed event emitted successfully.")
    }
}
