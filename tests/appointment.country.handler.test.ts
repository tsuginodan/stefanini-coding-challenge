import type { SQSEvent } from 'aws-lambda';

// Mocks
const storeAppointment = jest.fn();
jest.mock('../src/adapters/AWSRdsMySqlRepository', () => ({
  AWSRdsMySqlRepository: jest.fn().mockImplementation(() => ({ storeAppointment })),
}));

const emitProcessed = jest.fn();
jest.mock('../src/adapters/AWSEventBridgeEmitter', () => ({
  AWSEventBridgeEmitter: jest.fn().mockImplementation(() => ({ emitProcessed })),
}));

import { buildCountryAppointmentHandler } from '../src/handlers/appointmentCountryHandler';

function sqsEvent(bodies: any[]): SQSEvent {
  return {
    Records: bodies.map((b, i) => ({ messageId: `m${i}`, body: JSON.stringify(b) } as any)),
  } as any;
}

describe('appointmentCountryHandler', () => {
  const handler = buildCountryAppointmentHandler('PE');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully stores appointment and emits processed event', async () => {
    const payload = { insuredId: '12345', scheduleId: 99, countryISO: 'PE' };
    const res: any = await handler(sqsEvent([payload]) as any, {} as any, () => {});

    expect(res).toEqual({ batchItemFailures: [] });
    expect(storeAppointment).toHaveBeenCalledTimes(1);
    expect(storeAppointment).toHaveBeenCalledWith(payload);
    expect(emitProcessed).toHaveBeenCalledTimes(1);
    expect(emitProcessed).toHaveBeenCalledWith(payload);
  });

  it('returns batchItemFailures for invalid payload (schema validation fails)', async () => {
    const bad = { insuredId: '12', scheduleId: 1, countryISO: 'PE' }; // insuredId must be 5 chars
    const res: any = await handler(sqsEvent([bad]) as any, {} as any, () => {});

    expect(res.batchItemFailures).toHaveLength(1);
    expect(res.batchItemFailures[0]).toHaveProperty('itemIdentifier', 'm0');
    expect(storeAppointment).not.toHaveBeenCalled();
    expect(emitProcessed).not.toHaveBeenCalled();
  });
});
