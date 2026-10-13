import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('proxy CSP', () => {
  const originalEnv = process.env.EMBED_ALLOWED_PARTNER_ORIGINS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EMBED_ALLOWED_PARTNER_ORIGINS;
    } else {
      process.env.EMBED_ALLOWED_PARTNER_ORIGINS = originalEnv;
    }
  });

  it('sets a script-src directive restricted to self, no inline or third-party scripts', () => {
    const request = new NextRequest('https://zephyroute.app/');
    const response = proxy(request);

    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('sets a fresh, unique CSP nonce per request, per the security review finding', () => {
    const firstCsp = proxy(new NextRequest('https://zephyroute.app/')).headers.get(
      'Content-Security-Policy'
    );
    const secondCsp = proxy(new NextRequest('https://zephyroute.app/')).headers.get(
      'Content-Security-Policy'
    );

    const firstNonce = firstCsp?.match(/'nonce-([^']+)'/)?.[1];
    const secondNonce = secondCsp?.match(/'nonce-([^']+)'/)?.[1];

    expect(firstNonce).toBeTruthy();
    expect(secondNonce).toBeTruthy();
    expect(firstNonce).not.toBe(secondNonce);
  });

  it('includes strict-dynamic alongside the nonce, so Next.js can trust its own chunk-loaded scripts', () => {
    const response = proxy(new NextRequest('https://zephyroute.app/'));

    expect(response.headers.get('Content-Security-Policy')).toContain("'strict-dynamic'");
  });

  it('sets frame-ancestors none on non-embed routes, never embeddable anywhere (Story 4.2)', () => {
    const request = new NextRequest('https://zephyroute.app/');
    const response = proxy(request);

    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('defaults /embed to frame-ancestors none when no partner origin is configured', () => {
    delete process.env.EMBED_ALLOWED_PARTNER_ORIGINS;

    const request = new NextRequest('https://zephyroute.app/embed');
    const response = proxy(request);

    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('allowlists confirmed partner origins by name on /embed, never a wildcard', () => {
    process.env.EMBED_ALLOWED_PARTNER_ORIGINS = 'https://partner-a.example,https://partner-b.example:8443';

    const request = new NextRequest('https://zephyroute.app/embed');
    const response = proxy(request);

    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain('frame-ancestors https://partner-a.example https://partner-b.example:8443');
    expect(csp).not.toContain('*');
  });

  it('drops a malformed origin entry instead of trusting the env var verbatim', () => {
    process.env.EMBED_ALLOWED_PARTNER_ORIGINS = 'https://partner-a.example,*,https://evil.example/path,not-a-url';

    const request = new NextRequest('https://zephyroute.app/embed');
    const response = proxy(request);

    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain('frame-ancestors https://partner-a.example');
    expect(csp).not.toContain('*');
    expect(csp).not.toContain('evil.example/path');
    expect(csp).not.toContain('not-a-url');
  });
});
