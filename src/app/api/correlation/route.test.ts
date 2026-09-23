import { describe, expect, it, vi, beforeEach } from 'vitest';

const { writeCorrelationRecord, updateCorrelationRecordWithDeposit } = vi.hoisted(() => ({
  writeCorrelationRecord: vi.fn(),
  updateCorrelationRecordWithDeposit: vi.fn(),
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return { ...actual, writeCorrelationRecord, updateCorrelationRecordWithDeposit };
});

const { POST, PATCH } = await import('./route');

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

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/correlation', { method: 'PATCH', body: JSON.stringify(body) });
}

const VALID_DEPOSIT_UPDATE = {
  stellarAddress: 'GDEPOSITOR',
  destinationVault: 'CVAULT',
  depositStatus: 'completed' as const,
  depositConfirmedAt: '2026-09-22T00:00:00Z',
};

describe('PATCH /api/correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a body missing required fields with a 400, never reaching the update function', async () => {
    const response = await PATCH(patchRequest({ stellarAddress: 'GDEPOSITOR' }));

    expect(response.status).toBe(400);
    expect(updateCorrelationRecordWithDeposit).not.toHaveBeenCalled();
  });

  it('updates the record and returns ok on success', async () => {
    updateCorrelationRecordWithDeposit.mockResolvedValue(undefined);

    const response = await PATCH(patchRequest(VALID_DEPOSIT_UPDATE));

    expect(response.status).toBe(200);
    expect(updateCorrelationRecordWithDeposit).toHaveBeenCalledWith('GDEPOSITOR', {
      destinationVault: 'CVAULT',
      depositStatus: 'completed',
      depositConfirmedAt: '2026-09-22T00:00:00Z',
    });
  });

  it('surfaces a missing base record as a 404, never fabricating one', async () => {
    const { CorrelationRecordNotFoundError } = await import('@/lib/validation');
    updateCorrelationRecordWithDeposit.mockRejectedValue(
      new CorrelationRecordNotFoundError('No correlation record found.')
    );

    const response = await PATCH(patchRequest(VALID_DEPOSIT_UPDATE));

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error.code).toBe('CORRELATION_RECORD_NOT_FOUND');
  });
});
