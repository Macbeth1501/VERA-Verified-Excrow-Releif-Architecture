/**
 * Error envelope from SPDD §12.3: a specific, enumerable code — never a bare 500.
 */
export type ErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_FAILED"
  | "EMAIL_ALREADY_REGISTERED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "ORGANIZER_NOT_VERIFIED"
  | "ALREADY_APPLIED"
  | "ORGANIZER_NOT_FOUND"
  | "CAMPAIGN_NOT_FOUND"
  | "NOT_IMPLEMENTED"
  | "INDEXER_NOT_CONFIGURED"
  | "DONATIONS_NOT_CONFIGURED"
  | "WALLET_NOT_MANAGED"
  | "CAMPAIGN_NOT_OPEN"
  | "FEE_CHOICE_REQUIRED"
  | "DONATION_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "MILESTONE_NOT_FOUND"
  | "ESCROW_NOT_CONFIGURED"
  | "MILESTONE_NOT_READY"
  | "ROLE_NOT_SYNCED"
  | "ALREADY_DONE"
  | "ACTION_PENDING"
  | "CHAIN_UNAVAILABLE"
  | "CHAIN_FAILED"
  | "INTERNAL_ERROR";

export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): Response {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers });
}
