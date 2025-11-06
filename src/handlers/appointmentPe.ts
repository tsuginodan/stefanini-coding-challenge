import type {SQSHandler} from 'aws-lambda';
import {buildCountryAppointmentHandler} from "./appointmentCountryHandler";

/** Peru appointment Lambda function*/
export const handler: SQSHandler = buildCountryAppointmentHandler('PE');