/**
 * Simple in-memory sliding-window rate limiter for serverless Next.js route handlers.
 *
 * NOTE ON SERVERLESS TRADE-OFF: This in-memory rate limiter is per-instance on serverless
 * environments (such as Vercel), not a globally coordinated cap across concurrent worker
 * instances. This is an intentional zero-cost trade-off that throttles burst abuse on any
 * single instance without requiring paid infrastructure or an external database (e.g. Upstash
 * Redis). It is not a distributed hard guarantee across multiple serverless warm containers.
 */

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

interface ClientRecord {
  timestamps: number[];
}

// In-memory store per serverless isolate
const rateLimitStore = new Map<string, ClientRecord>();

// Automatically prune stale entries every 5 minutes to prevent memory leaks
let lastPrunedAt = Date.now();
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

function pruneStaleEntries(now: number, windowMs: number) {
  if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  lastPrunedAt = now;

  for (const [key, record] of rateLimitStore.entries()) {
    const valid = record.timestamps.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      rateLimitStore.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Checks and updates rate limit for an identifier (e.g. IP + endpoint).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  pruneStaleEntries(now, config.windowMs);

  let record = rateLimitStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Remove timestamps outside current window
  record.timestamps = record.timestamps.filter((ts) => now - ts < config.windowMs);

  const remaining = Math.max(0, config.limit - record.timestamps.length);
  const oldestTimestamp = record.timestamps[0] ?? now;
  const reset = Math.ceil((oldestTimestamp + config.windowMs) / 1000);

  if (record.timestamps.length >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset,
    };
  }

  // Record new hit
  record.timestamps.push(now);

  return {
    success: true,
    limit: config.limit,
    remaining: remaining - 1,
    reset,
  };
}

/**
 * Extracts client IP from standard reverse-proxy headers.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return '127.0.0.1';
}
