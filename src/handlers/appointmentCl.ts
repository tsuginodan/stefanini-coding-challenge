import type {SQSHandler} from 'aws-lambda';
import {buildCountryAppointmentHandler} from './appointmentCountryHandler';

/** Chile appointment Lambda function*/
export const handler: SQSHandler = buildCountryAppointmentHandler('CL');
