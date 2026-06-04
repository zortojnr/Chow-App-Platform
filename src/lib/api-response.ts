// API response helpers — backend-standards.md §1.4
// All route handlers must use these functions. Never construct raw NextResponse.json()
// objects in route handlers.
//
// Governed by: master-architecture.md §6.2, backend-standards.md §1.3–1.4, §5.2

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AppError } from './errors'

// Pagination metadata shape — master-architecture.md §6.2
export type PaginationMeta = {
  total: number
  page:  number
  limit: number
}

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status })
}

export function paginatedSuccessResponse<T>(
  data: T,
  meta: PaginationMeta,
  status = 200,
): NextResponse {
  return NextResponse.json({ success: true, data, meta }, { status })
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  data?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, ...(data ? { data } : {}) } },
    { status },
  )
}

export function validationErrorResponse(error: z.ZodError): NextResponse {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path) fields[path] = issue.message
  }
  return NextResponse.json(
    {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    },
    { status: 422 },
  )
}

export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSeconds = String(Math.ceil(retryAfterMs / 1000))
  return NextResponse.json(
    { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
    { status: 429, headers: { 'Retry-After': retryAfterSeconds } },
  )
}

export function serverErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return errorResponse(error.code, error.message, error.statusCode, error.data)
  }
  const message =
    process.env.NODE_ENV === 'development'
      ? error instanceof Error
        ? error.message
        : 'Unknown error'
      : 'An internal error occurred'
  return errorResponse('INTERNAL_ERROR', message, 500)
}
