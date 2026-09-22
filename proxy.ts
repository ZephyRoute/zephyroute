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

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    `script-src 'self'; object-src 'none'; base-uri 'self'; ${frameAncestorsDirective(request.nextUrl.pathname)}`
  );

  return response;
}

export const config = {
  matcher: '/:path*',
};
