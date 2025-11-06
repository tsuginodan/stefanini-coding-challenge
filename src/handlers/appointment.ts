import type {APIGatewayProxyEventV2, SQSBatchItemFailure, SQSBatchResponse, SQSEvent,} from 'aws-lambda';
import Joi from 'joi';
import {AWSDynamoDBRepository} from '../adapters/AWSDynamoDBRepository';
import {AWSSNSPublisher} from '../adapters/AWSSNSPublisher';
import type {AppointmentProcessedEventMessage, AppointmentRecord, CountryISO,} from 'index';


const awsDynamoDB = new AWSDynamoDBRepository();
const awsSNS = new AWSSNSPublisher();

function json<T>(statusCode: number, body: T) {
    return {statusCode, body: JSON.stringify(body)};
}

const postBodySchema = Joi.object({
    insuredId: Joi.string().length(5).required(),
    scheduleId: Joi.number().required(),
    countryISO: Joi.string().length(2).required(),
})

/** HTTP: POST /appointments */
async function handlePost(event: APIGatewayProxyEventV2) {
    let body;
    try {
        body = JSON.parse(event.body ?? '');
    } catch (e: any) {
        return json(400, {message: 'Invalid JSON body'});
    }
    const validated = postBodySchema.validate(body);
    if (validated.error) {
        return json(400, {message: 'One or more fields are invalid'});
    }

    const created: AppointmentRecord | undefined = await awsDynamoDB.saveAppointment(validated.value);
    if (!created) {
        return json(500, {message: 'Appointment not saved. Internal server error.'});
    }
    await awsSNS.publishAppointment({
        insuredId: created.insuredId,
        scheduleId: created.scheduleId,
        countryISO: created.countryISO as CountryISO,
    });
    return json(202, {id: created.id, status: created.status, request: validated.value});
}

/** HTTP: GET /appointments/{insuredId} */
async function handleGet(event: APIGatewayProxyEventV2) {
    const insuredId = event.pathParameters?.insuredId;
    if (!insuredId || !/^\d{5}$/.test(insuredId)) {
        return json(400, {message: 'insuredId path parameter must be exactly five digits'});
    }

    const items = await awsDynamoDB.getByInsuredId(insuredId);
    return json(200, {items});
}

/** SQS: listens to SQS triggered by EventBridge */
const handleStatusSqs = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const failures: SQSBatchItemFailure[] = [];
    for (const record of event.Records) {
        try {
            const body = JSON.parse(record.body) as { detail?: AppointmentProcessedEventMessage };
            const detail = body.detail;
            if (!detail) throw new Error('EventBridge Detail field is missing');
            await awsDynamoDB.updateAppointmentToCompleted(detail.insuredId, detail.scheduleId, detail.countryISO);
        } catch (err) {
            console.error('Failed to process status message', err);
            failures.push({itemIdentifier: record.messageId});
        }
    }
    return {batchItemFailures: failures};
};

/**
 * Main entry point for the Appointment Lambda function.
 */
export const handler = async (event: APIGatewayProxyEventV2 | SQSEvent) => {
    const isHttpRequest = event as APIGatewayProxyEventV2;
    if (isHttpRequest?.requestContext?.http?.method) {
        const method = isHttpRequest.requestContext.http?.method;
        const rawPath = isHttpRequest.rawPath;
        if (method === 'POST' && rawPath.startsWith('/appointments')) return handlePost(isHttpRequest);
        if (method === 'GET' && rawPath.startsWith('/appointments/')) return handleGet(isHttpRequest);
        return json(404, {message: 'Not Found'});
    }

    return await handleStatusSqs(event as SQSEvent);
};
