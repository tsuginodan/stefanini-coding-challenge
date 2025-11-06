import {PublishCommand, SNSClient} from '@aws-sdk/client-sns';
import type {AppointmentRequest} from 'index';
import {globalEnv} from "../config/env";

const awsSNS = new SNSClient({apiVersion: '2010-03-31'});


export class AWSSNSPublisher {
    private readonly client: SNSClient;
    private readonly topicArn: string;

    constructor(client: SNSClient = awsSNS, topicArn: string = globalEnv.TOPIC_ARN) {
        this.client = client;
        this.topicArn = topicArn;
    }

    async publishAppointment(request: AppointmentRequest): Promise<void> {
        const publishCommand = new PublishCommand({
            TopicArn: this.topicArn,
            Message: JSON.stringify(request),
            MessageAttributes: {
                countryISO: {DataType: 'String', StringValue: request.countryISO},
            },
        });
        await this.client.send(publishCommand);
    }
}
