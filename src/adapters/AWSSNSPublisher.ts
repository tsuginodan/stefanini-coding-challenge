import {PublishCommand, SNSClient} from '@aws-sdk/client-sns';
import type {AppointmentRequest} from 'index';
import {getGlobalEnv} from "../config/env";
import Logger from '../config/winston';

const awsSNS = new SNSClient({apiVersion: '2010-03-31'});


export class AWSSNSPublisher {
    private readonly client: SNSClient;
    private readonly topicArn: string;

    constructor(client: SNSClient = awsSNS) {
        this.client = client;
        this.topicArn = getGlobalEnv("TOPIC_ARN");
    }

    async publishAppointment(request: AppointmentRequest): Promise<void> {
        const publishCommand = new PublishCommand({
            TopicArn: this.topicArn,
            Message: JSON.stringify(request),
            MessageAttributes: {
                countryISO: {DataType: 'String', StringValue: request.countryISO},
            },
        });
        Logger.debug(`Publishing appointment: ${JSON.stringify(request)}`);
        await this.client.send(publishCommand);
        Logger.info(`Appointment for countryISO: [${request.countryISO}] published successfully.`)
    }
}
