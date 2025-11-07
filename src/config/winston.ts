import winston from 'winston';
import {Logger} from 'winston';
import {getGlobalEnv} from "./env";

const logger: Logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf(({timestamp, level, message}) => {
                    return `${timestamp} [${level}]: ${message}`;
                }),
            ),
        }),
    ],
    level: getGlobalEnv("LOG_LEVEL"),
});

export default logger;