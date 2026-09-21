import { describe, expect, it, vi, beforeEach } from 'vitest';

const set = vi.fn();

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({ set }),
}));

import {
  validateCorrelationRecord,
  writeCorrelationRecord,
  InvalidCorrelationRecordError,
} from './validation';

const validRecord = {
  stellarAddress: 'GABCDEFTESTPUBLICADDRESS',
  originChainAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
  settledAmount: '9969000',
  settledAt: '2026-09-21T12:00:00.000Z',
  integratorId: 'zephyroute',
  correlationId: 'corr-1',
};

describe('validateCorrelationRecord', () => {
  it('accepts a fully populated, correctly shaped record', () => {
    expect(validateCorrelationRecord(validRecord)).toEqual(validRecord);
  });

  it('rejects a record missing any required field, listing exactly which', () => {
    const { settledAt: _settledAt, ...incomplete } = validRecord;
    expect(() => validateCorrelationRecord(incomplete)).toThrow(InvalidCorrelationRecordError);
  });

  it('rejects a stellarAddress that is not a real G-address', () => {
    expect(() =>
      validateCorrelationRecord({ ...validRecord, stellarAddress: '0xnotstellar' })
    ).toThrow(InvalidCorrelationRecordError);
  });

  it('rejects an unparseable settledAt timestamp', () => {
    expect(() => validateCorrelationRecord({ ...validRecord, settledAt: 'not-a-date' })).toThrow(
      InvalidCorrelationRecordError
    );
  });
});

describe('writeCorrelationRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never persists an unvalidated record, rejecting before any Redis call', async () => {
    const { settledAt: _settledAt, ...incomplete } = validRecord;
    await expect(writeCorrelationRecord(incomplete)).rejects.toBeInstanceOf(
      InvalidCorrelationRecordError
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('persists a validated record keyed by Stellar address', async () => {
    await writeCorrelationRecord(validRecord);

    expect(set).toHaveBeenCalledWith(
      `correlation:${validRecord.stellarAddress}`,
      JSON.stringify(validRecord)
    );
  });
});
