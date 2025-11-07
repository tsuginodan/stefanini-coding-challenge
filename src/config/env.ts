import Joi from 'joi';
import type {CountryISO} from "index";

interface GlobalEnv {
    APPOINTMENTS_TABLE: string;
    TOPIC_ARN: string;
    LOG_LEVEL: string;
}

const globalEnvSchema = Joi.object<GlobalEnv>({
    APPOINTMENTS_TABLE: Joi.string().required(),
    TOPIC_ARN: Joi.string().required(),
    LOG_LEVEL: Joi.string().default('info'),
});

export type CountryEnv = {
    MYSQL_HOST: string;
    MYSQL_PORT: number;
    MYSQL_USER: string;
    MYSQL_PASSWORD: string;
    MYSQL_DB: string;
    MYSQL_CONNECTION_LIMIT: number;
}
const countryEnvSchema = Joi.object<CountryEnv>({
    MYSQL_HOST: Joi.string().required(),
    MYSQL_PORT: Joi.number().default(3306),
    MYSQL_USER: Joi.string().required(),
    MYSQL_PASSWORD: Joi.string().required(),
    MYSQL_DB: Joi.string().required(),
    MYSQL_CONNECTION_LIMIT: Joi.number().default(2),
});
const readCountryEnv = (prefix: string) => {
    return {
        MYSQL_HOST: process.env[`${prefix}MYSQL_HOST`],
        MYSQL_PORT: process.env[`${prefix}MYSQL_PORT`],
        MYSQL_USER: process.env[`${prefix}MYSQL_USER`],
        MYSQL_PASSWORD: process.env[`${prefix}MYSQL_PASSWORD`],
        MYSQL_DB: process.env[`${prefix}MYSQL_DB`],
        MYSQL_CONNECTION_LIMIT: process.env[`${prefix}MYSQL_CONNECTION_LIMIT`],
    }
}

export const getGlobalEnv = (env: keyof GlobalEnv) => {
    const {value, error} = globalEnvSchema.validate(process.env, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
    });
    if (error) throw new Error('Missing required environment variables. ' + error.message);
    return value[env];
};

export const countryEnv = (countryISO: CountryISO) => {
    const {value, error} =
        countryEnvSchema.validate(readCountryEnv(`${countryISO.toString().toUpperCase()}_`), {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
    if (error) throw new Error('Missing required country environment variables. ' + error.message);
    return value;
}