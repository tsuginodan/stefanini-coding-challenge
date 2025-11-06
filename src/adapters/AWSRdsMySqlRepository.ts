import type {AppointmentRequest, CountryISO} from 'index';
import {countryEnv} from "../config/env";
// import {Pool} from "mysql2/promise"; // commented out. Using a mock Pool instead

export class AWSRdsMySqlRepository {
    private readonly poolRegistry: PoolRegistry;
    private readonly countryISO: CountryISO;

    constructor(
        countryISO: CountryISO,
    ) {
        this.countryISO = countryISO;
        this.poolRegistry = new PoolRegistry(new EnvCountryDbConfigStrategy());
    }

    /** Persist an appointment row into the country-specific database. */
    async storeAppointment(payload: AppointmentRequest): Promise<void> {
        const pool = await this.poolRegistry.getPool(this.countryISO);

        const sql = `INSERT INTO appointments (insuredId, scheduleId, countryISO, createdAt)
                     VALUES (?, ?, ?, ?)`;
        const params = [payload.insuredId, payload.scheduleId, payload.countryISO, new Date()];
        await pool.execute(sql, params);
    }

    /** Retrieve all appointments for a country (ordered by createdAt desc). */
    async getAll(): Promise<AppointmentRequest[]> {
        const pool = await this.poolRegistry.getPool(this.countryISO);

        const [rows] = await pool.execute(
            `SELECT insuredId, scheduleId, countryISO
             FROM appointments
             WHERE countryISO = ?
             ORDER BY createdAt DESC`,
            [this.countryISO]
        );

        return (rows as any[]).map((r) => ({
            insuredId: String(r.insuredId),
            scheduleId: Number(r.scheduleId),
            countryISO: String(r.countryISO) as CountryISO,
        }));
    }
}

export type DbConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectionLimit: number;
};
export interface RDSByCountryConfigStrategy {
    getConfig(countryISO: CountryISO): DbConfig;
}

/**
 * Get RDS mysql connection pool by countryISO
 */
export class EnvCountryDbConfigStrategy implements RDSByCountryConfigStrategy {
    getConfig(countryISO: CountryISO): DbConfig {
        const env = countryEnv(countryISO);

        const host = env.MYSQL_HOST;
        const port = +(env.MYSQL_PORT);
        const user = env.MYSQL_USER;
        const password = env.MYSQL_PASSWORD;
        const database = env.MYSQL_DB;
        const connectionLimit = +(env.MYSQL_CONNECTION_LIMIT);

        return {host, port, user, password, database, connectionLimit};
    }
}

/**
 * TODO. Not going to query/call real RDS, store everything in memory.
 */
// class PoolRegistry {
//     private readonly strategy: RDSByCountryConfigStrategy;
//     private readonly pools: Map<string, Pool> = new Map();
//
//     constructor(strategy: RDSByCountryConfigStrategy) {
//         this.strategy = strategy;
//     }
//
//     async getPool(countryISO: CountryISO): Promise<Pool> {
//         const key = countryISO.toString().toUpperCase();
//         const poolByCountryMap = this.pools.get(key);
//         if (poolByCountryMap) return poolByCountryMap;
//
//         const cfg = this.strategy.getConfig(countryISO);
//         const mysql = await import('mysql2/promise').catch((e) => {
//             throw new Error(
//                 'mysql2 package is required. Error: ' + e
//             );
//         });
//
//         const pool = mysql.createPool({
//             host: cfg.host,
//             port: cfg.port,
//             user: cfg.user,
//             password: cfg.password,
//             database: cfg.database,
//             waitForConnections: true,
//             connectionLimit: cfg.connectionLimit,
//             queueLimit: 0,
//             dateStrings: false,
//         });
//
//         this.pools.set(key, pool);
//         return pool;
//     }
// }

/**
 * In-memory pool registry
 */
class PoolRegistry {
    private readonly strategy: RDSByCountryConfigStrategy;
    private readonly pools: Map<string, MockPool> = new Map();

    constructor(strategy: RDSByCountryConfigStrategy) {
        this.strategy = strategy;
    }

    async getPool(countryISO: CountryISO): Promise<MockPool> {
        const key = countryISO.toString().toUpperCase();
        const poolByCountryMap = this.pools.get(key);
        if (poolByCountryMap) return poolByCountryMap;
        const pool = createMockPool(countryISO);
        this.pools.set(key, pool);
        return pool;
    }
}

type MockRow = { insuredId: string; scheduleId: number; countryISO: CountryISO; createdAt: Date };
type MockExecuteResult = [any[], any];

interface MockPool {
    execute(sql: string, params?: any[]): Promise<MockExecuteResult>;
}

const mockDb: Map<string, MockRow[]> = new Map();

function createMockPool(countryISO: CountryISO): MockPool {
    const key = countryISO.toString().toUpperCase();
    return {
        async execute(sql: string, params?: any[]): Promise<MockExecuteResult> {
            const normalized = sql.trim().toUpperCase();

            if (normalized.startsWith('INSERT INTO')) {
                if (!Array.isArray(params) || params.length < 4) {
                    throw new Error('MockPool INSERT expects params [insuredId, scheduleId, countryISO, createdAt]');
                }
                const [insuredId, scheduleId, countryISOParam, createdAt] = params;
                const list = mockDb.get(key) ?? [];
                list.push({
                    insuredId: insuredId,
                    scheduleId: +scheduleId,
                    countryISO: countryISOParam as CountryISO,
                    createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
                });
                mockDb.set(key, list);
                return [[], undefined];
            }

            if (normalized.startsWith('SELECT')) {
                const rows = [...(mockDb.get(key) ?? [])]
                    .filter(r => r.countryISO.toUpperCase() === key)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map(r => ({insuredId: r.insuredId, scheduleId: r.scheduleId, countryISO: r.countryISO}));
                return [rows, undefined];
            }

            throw new Error('Unsupported SQL in MockPool: ' + sql);
        }
    };
}
