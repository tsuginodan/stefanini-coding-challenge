import type { APIGatewayProxyEventV2, SQSEvent } from 'aws-lambda';

// Mock adapters before importing the handler
const createPending = jest.fn();
const getByInsuredId = jest.fn();
const markCompletedByComposite = jest.fn();

jest.mock('../src/adapters/AWSDynamoDBRepository', () => {
  return {
    AWSDynamoDBRepository: jest.fn().mockImplementation(() => ({
      saveAppointment: createPending,
      getByInsuredId,
      updateAppointmentToCompleted: markCompletedByComposite,
    })),
  };
});

const publishAppointment = jest.fn();
jest.mock('../src/adapters/AWSSNSPublisher', () => {
  return {
    AWSSNSPublisher: jest.fn().mockImplementation(() => ({
      publishAppointment,
    })),
  };
});

// Import after mocks are set up
import { handler } from '../src/handlers/appointment';

function httpEvent(method: 'GET' | 'POST', rawPath: string, body?: any, pathParams?: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'test',
      domainPrefix: 'test',
      http: { method, path: rawPath, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
      requestId: 'req',
      routeKey: '$default',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    } as any,
    isBase64Encoded: false,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    pathParameters: pathParams,
  } as any;
}

describe('appointment.handler (HTTP)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /appointments returns 202 and publishes SNS', async () => {
    const payload = { insuredId: '01234', scheduleId: 123, countryISO: 'PE' };
    const created = {
      id: 'uuid-1',
      insuredId: payload.insuredId,
      scheduleId: payload.scheduleId,
      countryISO: payload.countryISO,
      status: 'pending' as const,
      createdAt: 'now',
      updatedAt: 'now',
    };
    createPending.mockResolvedValueOnce(created);
    publishAppointment.mockResolvedValueOnce(undefined);

    const res: any = await handler(httpEvent('POST', '/appointments', payload));
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ id: created.id, status: 'pending', request: payload });
    expect(createPending).toHaveBeenCalledWith(payload);
    expect(publishAppointment).toHaveBeenCalledWith(payload);
  });

  it('POST /appointments with invalid JSON returns 400', async () => {
    const res: any = await handler(httpEvent('POST', '/appointments', '{bad json')); // invalid JSON string
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Invalid JSON body/);
  });

  it('GET /appointments/{insuredId} returns 200 with items', async () => {
    const items = [
      { id: '1', insuredId: '00001', scheduleId: 5, countryISO: 'PE', status: 'pending', createdAt: 't', updatedAt: 't' },
    ];
    getByInsuredId.mockResolvedValueOnce(items);

    const res: any = await handler(httpEvent('GET', '/appointments/00001', undefined, { insuredId: '00001' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toEqual(items);
    expect(getByInsuredId).toHaveBeenCalledWith('00001');
  });

  it('GET /appointments/{insuredId} with invalid id returns 400', async () => {
    const res: any = await handler(httpEvent('GET', '/appointments/abc', undefined, { insuredId: 'abc' }));
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/insuredId path parameter/);
  });
});

describe('appointment.handler (SQS status consumer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function sqsEvent(bodies: any[]): SQSEvent {
    return {
      Records: bodies.map((b, i) => ({
        messageId: `m${i}`,
        body: JSON.stringify(b),
      } as any)),
    } as any;
  }

  it('processes status messages successfully', async () => {
    markCompletedByComposite.mockResolvedValueOnce(undefined);
    const event = sqsEvent([{ detail: { insuredId: '01234', scheduleId: 1, countryISO: 'PE' } }]);
    const res: any = await handler(event);
    expect(res).toEqual({ batchItemFailures: [] });
    expect(markCompletedByComposite).toHaveBeenCalledWith('01234', 1, 'PE');
  });

  it('returns batchItemFailures on invalid message', async () => {
    markCompletedByComposite.mockResolvedValueOnce(undefined);
    const event = sqsEvent([{ detail: { insuredId: '01234', scheduleId: 1, countryISO: 'PE' } }, { noDetail: true }]);
    const res: any = await handler(event);
    expect(res.batchItemFailures).toHaveLength(1);
    expect(res.batchItemFailures[0]).toHaveProperty('itemIdentifier', 'm1');
  });
});
