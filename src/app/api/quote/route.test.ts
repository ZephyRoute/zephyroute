import { describe, expect, it, vi, beforeEach } from 'vitest';

const { requestQuote } = vi.hoisted(() => ({ requestQuote: vi.fn() }));

vi.mock('@/lib/one-click-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/one-click-client')>(
    '@/lib/one-click-client'
  );
  return { ...actual, requestQuote };
});

const { POST } = await import('./route');

const VALID_BODY = {
  originAsset: 'nep141:eth.origin',
  destinationAsset: 'nep245:usdc.stellar',
  amount: '1000000',
  recipient: 'GDESTINATION',
  refundTo: '0xrefund',
  slippageToleranceBps: 100,
  deadline: '2026-01-01T00:00:00Z',
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/quote', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/quote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed JSON with a 400 error envelope, never reaching requestQuote', async () => {
    const response = await POST(new Request('http://localhost/api/quote', { method: 'POST', body: 'not json' }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('INVALID_REQUEST_BODY');
    expect(requestQuote).not.toHaveBeenCalled();
  });

  it('rejects a body missing required fields with a 400, never reaching requestQuote', async () => {
    const response = await POST(postRequest({ originAsset: 'x' }));

    expect(response.status).toBe(400);
    expect(requestQuote).not.toHaveBeenCalled();
  });

  it('returns the quote verbatim on success', async () => {
    requestQuote.mockResolvedValue({ quote: { amountOut: '999' } });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ quote: { amountOut: '999' } });
    expect(requestQuote).toHaveBeenCalledWith(VALID_BODY);
  });

  it('surfaces a rejected route as a 422 QUOTE_REJECTED envelope', async () => {
    const { QuoteRejectedError } = await import('@/lib/one-click-client');
    requestQuote.mockRejectedValue(new QuoteRejectedError('This route is currently unavailable.'));

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.error.code).toBe('QUOTE_REJECTED');
  });

  it('never leaks a raw stack trace or cause for an unexpected failure', async () => {
    requestQuote.mockRejectedValue(new Error('ECONNRESET at internal socket details'));

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('QUOTE_REQUEST_FAILED');
    expect(JSON.stringify(payload)).not.toContain('ECONNRESET');
  });
});
