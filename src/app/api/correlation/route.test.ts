import { describe, expect, it, vi, beforeEach } from 'vitest';

const { writeCorrelationRecord } = vi.hoisted(() => ({ writeCorrelationRecord: vi.fn() }));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return { ...actual, writeCorrelationRecord };
});

const { POST } = await import('./route');

const VALID_RECORD = {
  stellarAddress: 'GDEPOSITOR',
  originChainAsset: 'nep141:eth.origin',
  settledAmount: '10000000',
  settledAt: '2026-09-22T00:00:00Z',
  integratorId: 'zephyroute',
  correlationId: 'abc123',
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/correlation', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed JSON with a 400, never reaching writeCorrelationRecord', async () => {
    const response = await POST(
      new Request('http://localhost/api/correlation', { method: 'POST', body: 'not json' })
    );

    expect(response.status).toBe(400);
    expect(writeCorrelationRecord).not.toHaveBeenCalled();
  });

  it('writes a valid record and returns ok', async () => {
    writeCorrelationRecord.mockResolvedValue(undefined);

    const response = await POST(postRequest(VALID_RECORD));

    expect(response.status).toBe(200);
    expect(writeCorrelationRecord).toHaveBeenCalledWith(VALID_RECORD);
  });

  it('surfaces an invalid record as a 400 INVALID_CORRELATION_RECORD envelope', async () => {
    const { InvalidCorrelationRecordError } = await import('@/lib/validation');
    writeCorrelationRecord.mockRejectedValue(
      new InvalidCorrelationRecordError('stellarAddress must be a Stellar G-address.')
    );

    const response = await POST(postRequest({ ...VALID_RECORD, stellarAddress: 'not-an-address' }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('INVALID_CORRELATION_RECORD');
  });

  it('never leaves a Redis failure silent at this layer, even though the caller may choose to ignore it', async () => {
    writeCorrelationRecord.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await POST(postRequest(VALID_RECORD));

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('CORRELATION_WRITE_FAILED');
    expect(JSON.stringify(payload)).not.toContain('ECONNREFUSED');
  });
});
