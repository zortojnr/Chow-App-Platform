// Typed API fetch wrapper for client-side data fetching.
// frontend-standards.md §4.2 — all API calls from Client Components and
// hooks must use these helpers. Never call fetch() directly in components.
//
// Response envelope (from api-response.ts):
//   Success:    { success: true, data: T, meta?: PaginationMeta }
//   Error:      { success: false, error: { code, message, fields? } }
//
// Error handling:
//   401 — throws ApiError with code UNAUTHORIZED; TanStack Query mutation
//          error handlers redirect to /login?callbackUrl=...
//   Other failures — throws ApiError with the server's code + message

export class ApiError extends Error {
  constructor(
    public readonly code:    string,
    message:                 string,
    public readonly status:  number,
    public readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Internal ────────────────────────────────────────────────

type ApiEnvelope<T> =
  | { success: true;  data: T; meta?: PaginationMeta }
  | { success: false; error: { code: string; message: string; fields?: Record<string, string> } }

export type PaginationMeta = {
  total: number
  page:  number
  limit: number
}

export type PaginatedResponse<T> = {
  data: T
  meta: PaginationMeta
}

async function request<T>(
  path:    string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const envelope: ApiEnvelope<T> = await response.json()

  if (!envelope.success) {
    throw new ApiError(
      envelope.error.code,
      envelope.error.message,
      response.status,
      envelope.error.fields,
    )
  }

  return envelope.data
}

async function requestPaginated<T>(
  path:    string,
  options: RequestInit = {},
): Promise<PaginatedResponse<T>> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const envelope: ApiEnvelope<T> = await response.json()

  if (!envelope.success) {
    throw new ApiError(
      envelope.error.code,
      envelope.error.message,
      response.status,
      envelope.error.fields,
    )
  }

  return {
    data: envelope.data,
    meta: envelope.meta!,
  }
}

// ─── Public helpers ───────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export async function apiGetPaginated<T>(path: string): Promise<PaginatedResponse<T>> {
  return requestPaginated<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

export async function apiDelete(path: string): Promise<void> {
  await request<void>(path, { method: 'DELETE' })
}
