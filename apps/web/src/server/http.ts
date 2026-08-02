import { PLATFORM } from '@edt/shared';

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly provider: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

interface FetchOptions {
  provider: string;
  /** Seconds Next.js should cache the response on the server. */
  revalidate?: number;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Treat a 404 as an empty result rather than an error. */
  allowNotFound?: boolean;
}

const DEFAULT_TIMEOUT = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 12_000);
const USER_AGENT = `${PLATFORM.shortName}/${PLATFORM.version} (+https://earthdigitaltwin.ai)`;

/**
 * Hardened upstream fetch: bounded timeout, jittered exponential backoff on
 * transient failures, and Next's data cache for provider-appropriate TTLs.
 */
export async function fetchUpstream<T>(url: string, options: FetchOptions): Promise<T> {
  const {
    provider,
    revalidate = 300,
    timeoutMs = DEFAULT_TIMEOUT,
    retries = 2,
    headers = {},
    method = 'GET',
    body,
    allowNotFound = false,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'user-agent': USER_AGENT,
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: options.signal ?? controller.signal,
        next: { revalidate },
      });

      if (response.status === 404 && allowNotFound) {
        return null as T;
      }

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        const text = await response.text().catch(() => '');
        const error = new UpstreamError(
          `${provider} responded ${response.status}${text ? `: ${text.slice(0, 240)}` : ''}`,
          response.status,
          provider,
          url,
        );
        if (retryable && attempt < retries) {
          lastError = error;
          await backoff(attempt);
          continue;
        }
        throw error;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json') || contentType.includes('geo+json')) {
        return (await response.json()) as T;
      }
      return (await response.text()) as unknown as T;
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (error instanceof UpstreamError && !isAbort) throw error;
      if (attempt < retries) {
        await backoff(attempt);
        continue;
      }
      if (isAbort) {
        throw new UpstreamError(`${provider} timed out after ${timeoutMs}ms`, 504, provider, url);
      }
      throw new UpstreamError(
        `${provider} request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        502,
        provider,
        url,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new UpstreamError(`${provider} request failed`, 502, provider, url);
}

/** Fetch CSV text (FIRMS, CelesTrak and other legacy feeds). */
export async function fetchText(url: string, options: FetchOptions): Promise<string> {
  return fetchUpstream<string>(url, {
    ...options,
    headers: { accept: 'text/plain', ...options.headers },
  });
}

async function backoff(attempt: number): Promise<void> {
  const base = 250 * 2 ** attempt;
  const jitter = Math.random() * 150;
  await new Promise((resolve) => setTimeout(resolve, base + jitter));
}

/** Build a URL with only the defined query parameters. */
export function buildUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Parse a minimal CSV (no embedded newlines) into records keyed by header. */
export function parseCsv(input: string): Record<string, string>[] {
  const lines = input.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    if (cells.length === 1 && cells[0] === '') continue;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });
    rows.push(record);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}
