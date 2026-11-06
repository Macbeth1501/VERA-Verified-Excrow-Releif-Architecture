import { apiError } from "../api/errors";
import type { DisbursementFailure } from "./service";

/** Maps a payout service failure to the standard API error response. */
export const disbursementError = (f: DisbursementFailure) => apiError(f.status, f.code, f.message);
