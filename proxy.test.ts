import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('proxy CSP', () => {
  it('sets a script-src directive restricted to self, no inline or third-party scripts', () => {
    const request = new NextRequest('https://zephyroute.app/');
    const response = proxy(request);

    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });
});
