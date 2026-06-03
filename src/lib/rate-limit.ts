// PostgreSQL-backed rate limiter — backend-standards.md §7, track-02 §7.4
//
// Uses the RateLimit table (database-track.md §3.12). No Redis required in Phase 1.
// Rate limit checks run before authentication or validation in affected route handlers.
//
// Note: TOCTOU window is acceptable at Phase 1 scale. If throughput demands atomic
// enforcement, the upgrade path is Redis (backend-standards.md §7, final paragraph).

import { db } from './db'

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number }

/**
 * Checks whether the given key has exceeded its limit within the time window.
 * Creates or resets the window entry as needed.
 *
 * @param key     Unique rate limit key, e.g. "intake:1.2.3.4"
 * @param limit   Maximum number of requests permitted in the window
 * @param windowMs Window duration in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date()
  const existing = await db.rateLimit.findUnique({ where: { key } })

  // No record or window has expired — create / reset
  if (!existing || existing.windowStart.getTime() + windowMs < now.getTime()) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    })
    return { allowed: true }
  }

  // Window active and limit reached
  if (existing.count >= limit) {
    const retryAfterMs = existing.windowStart.getTime() + windowMs - now.getTime()
    return { allowed: false, retryAfterMs }
  }

  // Window active and under limit — increment
  await db.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  })
  return { allowed: true }
}
