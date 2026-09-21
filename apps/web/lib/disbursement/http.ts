import { apiError } from "../api/errors";
import type { DisbursementFailure } from "./service";

export const disbursementError = (f: DisbursementFailure) => apiError(f.status, f.code, f.message);
