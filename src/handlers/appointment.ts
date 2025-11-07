import type {APIGatewayProxyEventV2, SQSBatchItemFailure, SQSBatchResponse, SQSEvent,} from 'aws-lambda';
import Joi from 'joi';
import {AWSDynamoDBRepository} from '../adapters/AWSDynamoDBRepository';
import {AWSSNSPublisher} from '../adapters/AWSSNSPublisher';
import type {AppointmentProcessedEventMessage, AppointmentRecord, CountryISO,} from 'index';
import {AppointmentRequest} from "../index";
import Logger from '../config/winston';


const awsDynamoDB = new AWSDynamoDBRepository();
const awsSNS = new AWSSNSPublisher();

function json<T>(statusCode: number, body: T) {
    return {statusCode, body: JSON.stringify(body)};
}

/** HTTP: POST /appointments */
const postEventBodySchema = Joi.object({
    insuredId: Joi.string().length(5).required(),
    scheduleId: Joi.number().required(),
    countryISO: Joi.string().length(2).required(),
});
const handlePost = async (event: APIGatewayProxyEventV2) => {
    const appointmentRequest: AppointmentRequest = JSON.parse(event.body || '{}') as AppointmentRequest;
    Logger.debug(`Received request body: ${JSON.stringify(event.body)}`)

    let created: AppointmentRecord;
    try {
        created = await awsDynamoDB.saveAppointment(appointmentRequest);
    } catch (e: unknown) {
        return json(500, {message: 'Failed to save appointment'});
    }

    await awsSNS.publishAppointment({
        insuredId: created.insuredId,
        scheduleId: created.scheduleId,
        countryISO: created.countryISO as CountryISO,
    });
    return json(202, {id: created.id, status: created.status, request: appointmentRequest});
}

/** HTTP: GET /appointments/{insuredId} */
const getPathParametersSchema = Joi.object({
    pathParameters: Joi.object({
        insuredId: Joi.string().length(5).required(),
    })
});
const handleGet = async (event: APIGatewayProxyEventV2) => {
    const insuredId = event.pathParameters!!.insuredId!!;
    Logger.debug(`Received request for insuredId: [${insuredId}]`);

    try {
        const items = await awsDynamoDB.getByInsuredId(insuredId);
        return json(200, {items});
    } catch (e: unknown) {
        return json(500, {message: 'Failed to get appointments for insuredId'});
    }
}

/** SQS: listens to SQS triggered by EventBridge */
const handleStatusSqs = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const failures: SQSBatchItemFailure[] = [];
    for (const record of event.Records) {
        try {
            const body = JSON.parse(record.body) as { detail?: AppointmentProcessedEventMessage };
            const detail = body.detail;
            if (!detail) {
                Logger.error(`Invalid message received: ${JSON.stringify(body)}`);
                failures.push({itemIdentifier: record.messageId});
                continue;
            }
            await awsDynamoDB.updateAppointmentToCompleted(detail.insuredId, detail.scheduleId, detail.countryISO);
        } catch (err) {
            Logger.error('Failed to process status message', err);
            failures.push({itemIdentifier: record.messageId});
        }
    }
    return {batchItemFailures: failures};
};

/**
 * Main entry point for the Appointment Lambda function.
 */
export const handler = async (event: APIGatewayProxyEventV2 | SQSEvent) => {
    const incomingHttpRequest = event as APIGatewayProxyEventV2;

    if (incomingHttpRequest?.requestContext?.http?.method) {

        const method = incomingHttpRequest.requestContext.http?.method;
        const rawPath = incomingHttpRequest.rawPath;

        if (method === 'POST' && rawPath.startsWith('/appointments')) {
            try {
                const {error} = postEventBodySchema.validate(JSON.parse(incomingHttpRequest.body || '{}'), {
                    abortEarly: false,
                    stripUnknown: true,
                });
                if (error) return json(400, {message: 'Invalid request body. ' + error.message});
                return handlePost(incomingHttpRequest);
            } catch (e: unknown) {
                return json(400, {message: 'Invalid request body.'});
            }
        }
        if (method === 'GET' && rawPath.startsWith('/appointments/')) {
            const {error} = getPathParametersSchema.validate(incomingHttpRequest, {
                abortEarly: false,
                stripUnknown: true,
            });
            if (error) return json(400, {message: 'Invalid "insuredId" path parameter. ' + error.message});
            return handleGet(incomingHttpRequest);
        }
        return json(404, {message: 'Not Found'});
    }
    return await handleStatusSqs(event as SQSEvent);
};
