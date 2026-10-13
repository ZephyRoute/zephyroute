import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PARTNER_ORIGIN_PATTERN = /^https:\/\/[a-zA-Z0-9.-]+(:\d+)?$/;

/**
 * Story 4.2, AC #1: confirmed partner origins allowed to frame `/embed`,
 * read from an env var so a new partner can be allowlisted without a
 * code change, never a wildcard. Empty by default, no partner is
 * currently confirmed (THORWallet deprioritized 2026-09-20). Malformed
 * entries (anything beyond a bare `https://host[:port]` origin, no
 * path, no wildcard) are dropped rather than trusted verbatim, an
 * env var is still an external input to this security boundary.
 */
function allowedPartnerOrigins(): string[] {
  const raw = process.env.EMBED_ALLOWED_PARTNER_ORIGINS ?? '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => PARTNER_ORIGIN_PATTERN.test(origin));
}

function frameAncestorsDirective(pathname: string): string {
  if (pathname !== '/embed') {
    // Story 4.2 finding: this was previously unset for every route, not
    // just `/embed`, so the standalone app itself could be framed by
    // any arbitrary site. Only `/embed` is meant to be embeddable.
    return "frame-ancestors 'none'";
  }
  const origins = allowedPartnerOrigins();
  return origins.length > 0
    ? `frame-ancestors ${origins.join(' ')}`
    : "frame-ancestors 'none'";
}

/**
 * Security review finding: `script-src 'self'` with no `'unsafe-inline'`
 * and no nonce blocks Next.js's own inline hydration payload scripts
 * (`self.__next_f.push(...)`), confirmed directly against a real
 * production build's rendered HTML, not just a theoretical CSP-spec
 * reading. Without this, the app would render its initial HTML and then
 * never hydrate in any real browser, no wallet connection, no
 * interactivity, nothing, while every existing check (unit tests on the
 * header string, `next build` succeeding, the test suite) stayed green,
 * since none of them execute the page in a browser. Fixed per Next.js's
 * own documented nonce pattern (`node_modules/next/dist/docs/01-app/
 * 02-guides/content-security-policy.md`): a fresh nonce per request,
 * forwarded via `x-nonce` so `layout.tsx` can force dynamic rendering,
 * combined with `'strict-dynamic'` so Next's own dynamically-loaded
 * chunk scripts stay trusted through the same nonce chain.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    frameAncestorsDirective(request.nextUrl.pathname),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: '/:path*',
};
