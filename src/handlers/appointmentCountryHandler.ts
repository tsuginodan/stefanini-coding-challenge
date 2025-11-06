import Joi from 'joi';
import type {SQSBatchItemFailure, SQSHandler} from 'aws-lambda';
import * as EBModule from '../adapters/AWSEventBridgeEmitter';
import {AWSRdsMySqlRepository} from '../adapters/AWSRdsMySqlRepository';
import type {AppointmentRequest, CountryISO} from 'index';

/**
 * Shared business logic for per-country lambda handlers
 */
export function buildCountryAppointmentHandler(countryISO: CountryISO): SQSHandler {
    const awsEventBridgeEmitter = new EBModule.AWSEventBridgeEmitter();
    const awsRDSMySql = new AWSRdsMySqlRepository(countryISO);

    const sqsMessageSchema = Joi.object({
        insuredId: Joi.string().length(5).required(),
        scheduleId: Joi.number().required(),
        countryISO: Joi.string().length(2).required(),
    });

    return async (event) => {
        const failures: SQSBatchItemFailure[] = [];
        for (const record of event.Records) {
            try {
                const payload = JSON.parse(record.body) as unknown;
                const validated = sqsMessageSchema.validate(payload);
                if (validated.error) throw new Error('Message received is not valid');
                const appointmentRequest: AppointmentRequest = validated.value;

                await awsRDSMySql.storeAppointment(appointmentRequest);

                await awsEventBridgeEmitter.emitProcessed({
                    insuredId: appointmentRequest.insuredId,
                    scheduleId: appointmentRequest.scheduleId,
                    countryISO: appointmentRequest.countryISO,
                });
            } catch (err) {
                console.error(`[${countryISO}] Failed to process record`, err);
                failures.push({itemIdentifier: record.messageId});
            }
        }

        return {batchItemFailures: failures};
    };
}
