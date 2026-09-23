import { describe, expect, it, vi, beforeEach } from 'vitest';

const { startEndUserRegistration } = vi.hoisted(() => ({ startEndUserRegistration: vi.fn() }));

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, startEndUserRegistration };
});

const { POST } = await import('./route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/register/challenge', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/register/challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a body missing email or externalId with a 400, never reaching DFNS', async () => {
    const response = await POST(postRequest({ email: 'a@b.com' }));

    expect(response.status).toBe(400);
    expect(startEndUserRegistration).not.toHaveBeenCalled();
  });

  it('returns the registration challenge on success', async () => {
    startEndUserRegistration.mockResolvedValue({ user: { id: 'u1' }, challenge: 'x' });

    const response = await POST(postRequest({ email: 'a@b.com', externalId: 'GDEPOSITOR' }));

    expect(response.status).toBe(200);
    expect(startEndUserRegistration).toHaveBeenCalledWith('a@b.com', 'GDEPOSITOR');
  });

  it('surfaces a missing DFNS config as a 503, not a generic 500', async () => {
    const { DfnsConfigError } = await import('@/lib/dfns-client');
    startEndUserRegistration.mockRejectedValue(new DfnsConfigError('DFNS is not configured.'));

    const response = await POST(postRequest({ email: 'a@b.com', externalId: 'GDEPOSITOR' }));

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error.code).toBe('ONBOARDING_NOT_CONFIGURED');
  });
});
