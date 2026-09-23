import { describe, expect, it, vi, beforeEach } from 'vitest';

const { writeCorrelationRecord, updateCorrelationRecordWithDeposit, verifyCorrelationWriteProof } =
  vi.hoisted(() => ({
    writeCorrelationRecord: vi.fn(),
    updateCorrelationRecordWithDeposit: vi.fn(),
    verifyCorrelationWriteProof: vi.fn(),
  }));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return { ...actual, writeCorrelationRecord, updateCorrelationRecordWithDeposit };
});
vi.mock('@/lib/auth-nonce', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-nonce')>('@/lib/auth-nonce');
  return { ...actual, verifyCorrelationWriteProof };
});

const { POST, PATCH } = await import('./route');

const WRITE_PROOF = { message: 'zephyroute:correlation-write:1758499200', signature: 'c2ln' };

const VALID_RECORD = {
  stellarAddress: 'GDEPOSITOR',
  originChainAsset: 'nep141:eth.origin',
  settledAmount: '10000000',
  settledAt: '2026-09-22T00:00:00Z',
  integratorId: 'zephyroute',
  correlationId: 'abc123',
  ...WRITE_PROOF,
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/correlation', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` resets call history, not implementations set via
    // `mockImplementation`; a prior test's throwing override would
    // otherwise leak into later tests, so restore a passing default.
    verifyCorrelationWriteProof.mockImplementation(() => undefined);
  });

  it('rejects malformed JSON with a 400, never reaching writeCorrelationRecord', async () => {
    const response = await POST(
      new Request('http://localhost/api/correlation', { method: 'POST', body: 'not json' })
    );

    expect(response.status).toBe(400);
    expect(writeCorrelationRecord).not.toHaveBeenCalled();
  });

  it('writes a valid record, stripped of the write-proof fields, once the proof verifies', async () => {
    writeCorrelationRecord.mockResolvedValue(undefined);

    const response = await POST(postRequest(VALID_RECORD));

    expect(response.status).toBe(200);
    expect(verifyCorrelationWriteProof).toHaveBeenCalledWith(
      'GDEPOSITOR',
      WRITE_PROOF.message,
      WRITE_PROOF.signature
    );
    const { message: _m, signature: _s, ...expectedRecord } = VALID_RECORD;
    expect(writeCorrelationRecord).toHaveBeenCalledWith(expectedRecord);
  });

  it(
    'rejects with a 401, never reaching writeCorrelationRecord, when the write proof does not verify ' +
      '(the unauthenticated-write finding this closes)',
    async () => {
      const { InvalidProofError } = await import('@/lib/auth-nonce');
      verifyCorrelationWriteProof.mockImplementation(() => {
        throw new InvalidProofError('Signature does not match the challenge and address.');
      });

      const response = await POST(postRequest(VALID_RECORD));

      expect(response.status).toBe(401);
      const payload = await response.json();
      expect(payload.error.code).toBe('INVALID_WRITE_PROOF');
      expect(writeCorrelationRecord).not.toHaveBeenCalled();
    }
  );

  it('rejects a body missing the write proof with a 400, never reaching writeCorrelationRecord', async () => {
    const { message: _m, signature: _s, ...withoutProof } = VALID_RECORD;

    const response = await POST(postRequest(withoutProof));

    expect(response.status).toBe(400);
    expect(writeCorrelationRecord).not.toHaveBeenCalled();
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
  ...WRITE_PROOF,
};

describe('PATCH /api/correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyCorrelationWriteProof.mockImplementation(() => undefined);
  });

  it('rejects a body missing required fields with a 400, never reaching the update function', async () => {
    const response = await PATCH(patchRequest({ stellarAddress: 'GDEPOSITOR' }));

    expect(response.status).toBe(400);
    expect(updateCorrelationRecordWithDeposit).not.toHaveBeenCalled();
  });

  it('updates the record and returns ok once the write proof verifies', async () => {
    updateCorrelationRecordWithDeposit.mockResolvedValue(undefined);

    const response = await PATCH(patchRequest(VALID_DEPOSIT_UPDATE));

    expect(response.status).toBe(200);
    expect(verifyCorrelationWriteProof).toHaveBeenCalledWith(
      'GDEPOSITOR',
      WRITE_PROOF.message,
      WRITE_PROOF.signature
    );
    expect(updateCorrelationRecordWithDeposit).toHaveBeenCalledWith('GDEPOSITOR', {
      destinationVault: 'CVAULT',
      depositStatus: 'completed',
      depositConfirmedAt: '2026-09-22T00:00:00Z',
    });
  });

  it('rejects with a 401, never reaching updateCorrelationRecordWithDeposit, when the write proof does not verify', async () => {
    const { InvalidProofError } = await import('@/lib/auth-nonce');
    verifyCorrelationWriteProof.mockImplementation(() => {
      throw new InvalidProofError('Signature does not match the challenge and address.');
    });

    const response = await PATCH(patchRequest(VALID_DEPOSIT_UPDATE));

    expect(response.status).toBe(401);
    expect(updateCorrelationRecordWithDeposit).not.toHaveBeenCalled();
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
