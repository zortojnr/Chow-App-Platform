// Response Token Service
//
// Issues and validates the one-time signed JWT that authorises a submitter to
// respond to a NEEDS_INFO request without a user session.
//
// Governed by: track-02-verification-intelligence.md §4.4, §7.3, §9.2
// Deliverable:  track-02 §12 Step 3
//
// DB scope: UsedVerificationToken only.
// Crypto:   HS256 via jose, SHA-256 via Node.js crypto.
// No orchestration, no email, no state machine calls.

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import { createHash } from 'crypto'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────
// CONSTANTS  §7.3
// ─────────────────────────────────────────────────────────────

/** Canonical token lifetime — referenced by notification.service.ts for email copy */
export const TOKEN_EXPIRY_DAYS = 14

const TOKEN_EXPIRY = `${TOKEN_EXPIRY_DAYS}d` as const

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** Claims embedded in the JWT payload — §7.3: no PII */
export type TokenPayload = {
  restaurantId: string
  verificationRecordId: string
  iat: number
  exp: number
}

/**
 * Discriminated result from validateResponseToken.
 * Callers map 'EXPIRED' and 'MALFORMED' → 400, 'INVALID_SIGNATURE' → 400.
 * The 410 (replay) path is handled separately via isTokenUsed.
 */
export type TokenValidationResult =
  | { valid: true; payload: TokenPayload }
  | { valid: false; reason: 'EXPIRED' | 'INVALID_SIGNATURE' | 'MALFORMED' }

// ─────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET
  if (!raw) throw new Error('NEXTAUTH_SECRET is not configured')
  return new TextEncoder().encode(raw)
}

// ─────────────────────────────────────────────────────────────
// TOKEN GENERATION  §4.4, §7.3
// ─────────────────────────────────────────────────────────────

/**
 * Creates a signed HS256 JWT bound to one restaurant and one verification record.
 * Token expires in 14 days. Contains no PII.
 */
export async function generateResponseToken(
  restaurantId: string,
  verificationRecordId: string,
): Promise<string> {
  return new SignJWT({ restaurantId, verificationRecordId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret())
}

// ─────────────────────────────────────────────────────────────
// TOKEN VALIDATION  §7.3, §9.2
// ─────────────────────────────────────────────────────────────

/**
 * Verifies the JWT signature and expiry claim.
 * Does NOT check replay — call isTokenUsed separately after this succeeds.
 *
 * Error mapping (§9.2):
 *   EXPIRED           → 400 (token window has closed)
 *   INVALID_SIGNATURE → 400 (tampered or from wrong environment)
 *   MALFORMED         → 400 (not a valid JWT, wrong algorithm, etc.)
 */
export async function validateResponseToken(token: string): Promise<TokenValidationResult> {
  const secret = getSecret()
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })

    return {
      valid: true,
      payload: {
        restaurantId: payload['restaurantId'] as string,
        verificationRecordId: payload['verificationRecordId'] as string,
        iat: payload.iat!,
        exp: payload.exp!,
      },
    }
  } catch (e) {
    if (e instanceof joseErrors.JWTExpired) {
      return { valid: false, reason: 'EXPIRED' }
    }
    if (e instanceof joseErrors.JWSSignatureVerificationFailed) {
      return { valid: false, reason: 'INVALID_SIGNATURE' }
    }
    return { valid: false, reason: 'MALFORMED' }
  }
}

// ─────────────────────────────────────────────────────────────
// TOKEN HASHING  §7.3
// ─────────────────────────────────────────────────────────────

/**
 * SHA-256 hash of the raw JWT string (header.payload.signature).
 * This is what is stored in UsedVerificationToken — never the token itself.
 * Exported so callers can inspect or log the hash without re-hashing.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ─────────────────────────────────────────────────────────────
// REPLAY PROTECTION  §4.4, §7.3
// ─────────────────────────────────────────────────────────────

/**
 * Records the token as used. Must be called AFTER the transition succeeds.
 *
 * Ordering matters: if the transition fails, the token must not be consumed
 * so the submitter can retry. Concurrent replays are rejected at the DB level
 * by the UNIQUE constraint on UsedVerificationToken.tokenHash.
 */
export async function markTokenUsed(token: string): Promise<void> {
  await db.usedVerificationToken.create({
    data: { tokenHash: hashToken(token) },
  })
}

/**
 * Returns true if this token has already been used.
 * Call this after validateResponseToken succeeds; a true result maps to 410 Gone.
 */
export async function isTokenUsed(token: string): Promise<boolean> {
  const record = await db.usedVerificationToken.findFirst({
    where: { tokenHash: hashToken(token) },
  })
  return record !== null
}
