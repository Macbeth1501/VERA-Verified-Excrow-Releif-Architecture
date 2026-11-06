/**
 * Minimal in-memory token bucket (SPDD §17.3). Adequate for a single-process demo; a shared
 * store would be needed if this ever ran on several instances.
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

/** Token-bucket settings: the burst `capacity` and how many tokens refill each second. */
export interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
}

/** Returns true if the request is allowed (and consumes a token). */
export function allow(key: string, { capacity, refillPerSecond }: RateLimitOptions, now = Date.now()): boolean {
  const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * refillPerSecond);
  bucket.updatedAt = now;
  const ok = bucket.tokens >= 1;
  if (ok) bucket.tokens -= 1;
  buckets.set(key, bucket);
  return ok;
}

/** Identifies the caller for rate limiting: the first `x-forwarded-for` address, or `local` when absent. */
export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Empties all buckets. Used by tests so one case's requests do not count against the next. */
export function resetRateLimits(): void {
  buckets.clear();
}
