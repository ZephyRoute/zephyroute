import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    "script-src 'self'; object-src 'none'; base-uri 'self'"
  );

  return response;
}

export const config = {
  matcher: '/:path*',
};
