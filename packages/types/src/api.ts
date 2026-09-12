/**
 * Shared /api/v1 response envelope. Contract only — see
 * docs/architecture/api-conventions.md for the full convention this
 * implements. Not used by apps/svegip today; its existing /api/* functions
 * keep their current response shapes unchanged by this PR.
 */

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    pagination?: Pagination;
    correlationId: string;
  };
}

export interface ApiErrorBody {
  error: {
    code: string; // stable machine-readable code, e.g. "ENTITY_ACCESS_DENIED"
    message: string; // human-readable, safe to display
    details?: unknown; // optional structured detail, never a raw stack trace
  };
  meta: {
    correlationId: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface Pagination {
  cursor?: string;
  nextCursor?: string;
  limit: number;
}

/** Propagated end-to-end per request; see api-conventions.md. */
export type CorrelationId = string;
