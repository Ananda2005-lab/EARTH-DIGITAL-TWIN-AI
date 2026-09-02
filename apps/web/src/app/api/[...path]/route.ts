import type { NextRequest } from 'next/server';

import { serverEnv } from '@/lib/env';

/**
 * Same-origin reverse proxy to the NestJS gateway.
 *
 * The browser client talks to `/api/*` rather than the gateway directly so that
 * httpOnly auth cookies are attached automatically, no CORS pre-flight is needed
 * and the gateway's origin never has to be public. Only the path segments after
 * `/api` are forwarded, so this cannot be used as an open proxy to arbitrary
 * hosts.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Headers that describe a single transport hop and must not be relayed. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  // Node fetch transparently decompresses upstream bodies. Relaying this header
  // would make the browser try to decompress an already-decoded response.
  'content-encoding',
]);

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function forwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!HOP_BY_HOP.has(name.toLowerCase())) headers.set(name, value);
  });

  // Preserve the caller's address for the gateway's rate limiter and audit log.
  const existing = request.headers.get('x-forwarded-for');
  const client = request.headers.get('x-real-ip') ?? '';
  if (!existing && client) headers.set('x-forwarded-for', client);
  headers.set('x-forwarded-host', request.headers.get('host') ?? '');
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

  // The gateway uses header versioning in addition to its `/api/v1` prefix.
  // Browser calls normally do not know about that transport detail, so supply
  // the current version unless an explicit version was requested.
  if (!headers.has('x-api-version')) headers.set('x-api-version', '1');

  return headers;
}

async function proxy(request: NextRequest, segments: string[]): Promise<Response> {
  const target = `${serverEnv().API_BASE_URL}/${segments.join('/')}${request.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: forwardHeaders(request),
      body: METHODS_WITH_BODY.has(request.method) ? await request.text() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (error) {
    // The gateway being unreachable is reported in the same envelope shape the
    // client already knows how to parse, so error handling stays uniform.
    return Response.json(
      {
        statusCode: 502,
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'The API gateway is unreachable.',
        path: `/api/${segments.join('/')}`,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (HOP_BY_HOP.has(name.toLowerCase())) return;
    // `set-cookie` has to be appended so multiple cookies survive the hop.
    if (name.toLowerCase() === 'set-cookie') responseHeaders.append(name, value);
    else responseHeaders.set(name, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: { path: string[] } };

export function GET(request: NextRequest, { params }: RouteContext): Promise<Response> {
  return proxy(request, params.path);
}

export function POST(request: NextRequest, { params }: RouteContext): Promise<Response> {
  return proxy(request, params.path);
}

export function PATCH(request: NextRequest, { params }: RouteContext): Promise<Response> {
  return proxy(request, params.path);
}

export function PUT(request: NextRequest, { params }: RouteContext): Promise<Response> {
  return proxy(request, params.path);
}

export function DELETE(request: NextRequest, { params }: RouteContext): Promise<Response> {
  return proxy(request, params.path);
}
