/**
 * Pre-warm the Next.js dev server by requesting every app route once, so
 * on-demand compilation happens up front instead of on the user's first click.
 * Run after the dev server is up:  `npm run prewarm --workspace @edt/web`
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'app'));
const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.PREWARM_TIMEOUT_MS ?? 25_000);
const CONCURRENCY = 3;

/** Recursively collect page routes. Route groups `(x)` are descended into
 * without contributing to the URL; dynamic `[x]` segments are skipped. */
function collectPages(dir, prefix) {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('[')) continue;
      if (entry.name.startsWith('(')) {
        routes.push(...collectPages(full, prefix));
        continue;
      }
      routes.push(...collectPages(full, `${prefix}/${entry.name}`));
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      routes.push(prefix === '' ? '/' : prefix);
    }
  }
  return routes;
}

const routes = [...new Set(collectPages(APP_DIR, ''))].sort();
console.log(`Prewarming ${routes.length} routes against ${BASE} ...`);

let done = 0;
let ok = 0;
const run = async (route) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const start = Date.now();
    const response = await fetch(`${BASE}${route}`, { signal: controller.signal });
    const took = Date.now() - start;
    const status = response.status;
    ok += status < 500 ? 1 : 0;
    console.log(`${status} ${took}ms ${route}`);
  } catch (error) {
    console.log(`ERR ${route} — ${error instanceof Error ? error.message : 'unknown'}`);
  } finally {
    clearTimeout(timer);
    done += 1;
    if (done % 10 === 0) console.log(`  ... ${done}/${routes.length}`);
  }
};

const queue = [...routes];
async function worker() {
  while (queue.length > 0) {
    const route = queue.shift();
    if (route) await run(route);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

console.log(`Prewarm finished: ${ok}/${routes.length} routes responded <500.`);
