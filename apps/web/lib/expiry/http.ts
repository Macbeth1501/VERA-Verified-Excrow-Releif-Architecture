import { apiError } from "../api/errors";
import { allow, clientKey } from "../api/rate-limit";
import type { ExpiryFailure } from "./service";

export const expiryError = (f: ExpiryFailure) => apiError(f.status, f.code, f.message);

/** Close and refund requests share one bucket per client: 10 requests, refilling one every 3 seconds. */
export const limited = (request: Request) =>
  allow(`expiry:${clientKey(request)}`, { capacity: 10, refillPerSecond: 1 / 3 })
    ? null
    : apiError(429, "RATE_LIMITED", "Too many requests. Please slow down.");
