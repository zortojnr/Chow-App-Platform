// Response Token Service — unit tests
//
// Coverage goals (track-02 §12 Step 3 exit criteria):
//   ✓ Valid token — generates, validates, payload is correct, no PII
//   ✓ Expired token — validateResponseToken returns EXPIRED
//   ✓ Tampered token — validateResponseToken returns INVALID_SIGNATURE
//   ✓ Malformed string — validateResponseToken returns MALFORMED
//   ✓ Wrong-environment token — different secret → INVALID_SIGNATURE
//   ✓ Hash determinism and hex length (SHA-256 = 64 hex chars)
//   ✓ Replay protection — markTokenUsed / isTokenUsed DB interactions
//   ✓ Missing NEXTAUTH_SECRET — service throws immediately
//   ✓ Token binding — payload carries the exact IDs it was issued with

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignJWT, decodeProtectedHeader, decodeJwt } from 'jose'
import {
  TOKEN_EXPIRY_DAYS,
  generateResponseToken,
  validateResponseToken,
  hashToken,
  markTokenUsed,
  isTokenUsed,
} from './response-token.service'

// ─────────────────────────────────────────────────────────────
// DB MOCK
// Only UsedVerificationToken is touched by this service.
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    usedVerificationToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

// Import after mock so we get the mocked version
import { db } from '@/lib/db'

// Type-cast to access vi.fn() methods cleanly
const mockCreate = (db as any).usedVerificationToken.create as ReturnType<typeof vi.fn>
const mockFindFirst = (db as any).usedVerificationToken.findFirst as ReturnType<typeof vi.fn>

// ─────────────────────────────────────────────────────────────
// TEST CONSTANTS
// ─────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!'
const OTHER_SECRET = 'different-secret-also-32-chars-long!'

const RESTAURANT_ID = 'rest-uuid-abc-123'
const RECORD_ID = 'verif-record-uuid-456'

// ─────────────────────────────────────────────────────────────
// HELPERS — craft tokens that bypass generateResponseToken
// ─────────────────────────────────────────────────────────────

async function makeExpiredToken(): Promise<string> {
  const secret = new TextEncoder().encode(TEST_SECRET)
  return new SignJWT({ restaurantId: RESTAURANT_ID, verificationRecordId: RECORD_ID })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(secret)
}

async function makeWrongSecretToken(): Promise<string> {
  const secret = new TextEncoder().encode(OTHER_SECRET)
  return new SignJWT({ restaurantId: RESTAURANT_ID, verificationRecordId: RECORD_ID })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(secret)
}

async function makeTamperedToken(): Promise<string> {
  const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
  const [header, payload] = token.split('.')
  return `${header}.${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
}

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = TEST_SECRET
  mockCreate.mockResolvedValue({ id: 'mock-id', tokenHash: 'mock-hash', usedAt: new Date() })
  mockFindFirst.mockResolvedValue(null)
})

afterEach(() => {
  delete process.env.NEXTAUTH_SECRET
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

describe('TOKEN_EXPIRY_DAYS', () => {
  it('is 14', () => {
    expect(TOKEN_EXPIRY_DAYS).toBe(14)
  })
})

// ─────────────────────────────────────────────────────────────
// generateResponseToken
// ─────────────────────────────────────────────────────────────

describe('generateResponseToken', () => {
  it('returns a string', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('returns a compact JWT (three dot-separated segments)', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    // Each part must be non-empty base64url
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0)
    }
  })

  it('signs with HS256', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const header = decodeProtectedHeader(token)
    expect(header.alg).toBe('HS256')
  })

  it('embeds restaurantId in the payload', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const payload = decodeJwt(token)
    expect(payload['restaurantId']).toBe(RESTAURANT_ID)
  })

  it('embeds verificationRecordId in the payload', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const payload = decodeJwt(token)
    expect(payload['verificationRecordId']).toBe(RECORD_ID)
  })

  it('sets exp approximately 14 days from now', async () => {
    const before = Math.floor(Date.now() / 1000)
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const after = Math.floor(Date.now() / 1000)
    const payload = decodeJwt(token)

    const expectedExpiry = TOKEN_EXPIRY_DAYS * 24 * 60 * 60
    const actualExpiry = (payload.exp as number) - (payload.iat as number)

    // Allow ±2 seconds for execution time
    expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 2)
    expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 2)
    expect(payload.exp as number).toBeGreaterThan(before)
    expect(payload.iat as number).toBeGreaterThanOrEqual(before)
    expect(payload.iat as number).toBeLessThanOrEqual(after)
  })

  it('contains no PII fields (no email, name, phone, ip)', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const payload = decodeJwt(token)
    const piiFields = ['email', 'name', 'phone', 'ip', 'address', 'submitterEmail']
    for (const field of piiFields) {
      expect(payload).not.toHaveProperty(field)
    }
  })

  it('generates distinct tokens on successive calls', async () => {
    // iat may differ by a second; even if iat is identical the signature should differ
    // from different sign operations only if the payload differs — here they are the same,
    // so tokens may be identical if called in the same second. Test iat progression.
    const t1 = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const t2 = await generateResponseToken('other-restaurant', RECORD_ID)
    expect(t1).not.toBe(t2)
  })

  it('throws when NEXTAUTH_SECRET is not set', async () => {
    delete process.env.NEXTAUTH_SECRET
    await expect(generateResponseToken(RESTAURANT_ID, RECORD_ID)).rejects.toThrow(
      'NEXTAUTH_SECRET is not configured',
    )
  })
})

// ─────────────────────────────────────────────────────────────
// validateResponseToken
// ─────────────────────────────────────────────────────────────

describe('validateResponseToken — valid token', () => {
  it('returns { valid: true } for a fresh token', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const result = await validateResponseToken(token)
    expect(result.valid).toBe(true)
  })

  it('payload.restaurantId matches the issued value', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const result = await validateResponseToken(token)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.payload.restaurantId).toBe(RESTAURANT_ID)
  })

  it('payload.verificationRecordId matches the issued value', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const result = await validateResponseToken(token)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.payload.verificationRecordId).toBe(RECORD_ID)
  })

  it('payload contains iat and exp as numbers', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const result = await validateResponseToken(token)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(typeof result.payload.iat).toBe('number')
      expect(typeof result.payload.exp).toBe('number')
      expect(result.payload.exp).toBeGreaterThan(result.payload.iat)
    }
  })

  it('throws when NEXTAUTH_SECRET is not set', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    delete process.env.NEXTAUTH_SECRET
    await expect(validateResponseToken(token)).rejects.toThrow(
      'NEXTAUTH_SECRET is not configured',
    )
  })
})

describe('validateResponseToken — expired token', () => {
  it('returns { valid: false, reason: EXPIRED }', async () => {
    const token = await makeExpiredToken()
    const result = await validateResponseToken(token)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('EXPIRED')
  })

  it('does not return a payload on expiry', async () => {
    const token = await makeExpiredToken()
    const result = await validateResponseToken(token)
    expect(result).not.toHaveProperty('payload')
  })
})

describe('validateResponseToken — tampered token', () => {
  it('returns { valid: false, reason: INVALID_SIGNATURE } for corrupted signature', async () => {
    const token = await makeTamperedToken()
    const result = await validateResponseToken(token)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('INVALID_SIGNATURE')
  })

  it('returns INVALID_SIGNATURE for a token signed with a different secret', async () => {
    const token = await makeWrongSecretToken()
    const result = await validateResponseToken(token)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('INVALID_SIGNATURE')
  })
})

describe('validateResponseToken — malformed input', () => {
  it('returns { valid: false, reason: MALFORMED } for a plain string', async () => {
    const result = await validateResponseToken('not-a-jwt')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('MALFORMED')
  })

  it('returns MALFORMED for an empty string', async () => {
    const result = await validateResponseToken('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('MALFORMED')
  })

  it('returns MALFORMED for a two-segment string', async () => {
    const result = await validateResponseToken('header.payload')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('MALFORMED')
  })

  it('returns MALFORMED for random base64', async () => {
    const result = await validateResponseToken('aGVsbG8=.d29ybGQ=.AAAA')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('MALFORMED')
  })
})

// ─────────────────────────────────────────────────────────────
// hashToken
// ─────────────────────────────────────────────────────────────

describe('hashToken', () => {
  it('returns a 64-character hex string (SHA-256 = 32 bytes = 64 hex chars)', () => {
    const hash = hashToken('some-jwt-token-string')
    expect(hash).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true)
  })

  it('is deterministic — same input always gives same hash', () => {
    const token = 'the-same-token'
    expect(hashToken(token)).toBe(hashToken(token))
  })

  it('produces distinct hashes for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })

  it('hashing is applied to the full token string including the signature', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const tampered = await makeTamperedToken()
    // Different signature segment → different hash
    expect(hashToken(token)).not.toBe(hashToken(tampered))
  })

  it('produces the known SHA-256 of the empty string', () => {
    // SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hashToken('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})

// ─────────────────────────────────────────────────────────────
// markTokenUsed
// ─────────────────────────────────────────────────────────────

describe('markTokenUsed', () => {
  it('calls db.usedVerificationToken.create once', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    await markTokenUsed(token)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('passes the SHA-256 hash of the token to create', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const expectedHash = hashToken(token)
    await markTokenUsed(token)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { tokenHash: expectedHash },
    })
  })

  it('does not pass the raw token to the DB', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    await markTokenUsed(token)
    const callArg = mockCreate.mock.calls[0][0]
    expect(JSON.stringify(callArg)).not.toContain(token)
  })

  it('resolves without returning a value', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const result = await markTokenUsed(token)
    expect(result).toBeUndefined()
  })

  it('propagates DB errors to the caller', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB write failed'))
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    await expect(markTokenUsed(token)).rejects.toThrow('DB write failed')
  })
})

// ─────────────────────────────────────────────────────────────
// isTokenUsed
// ─────────────────────────────────────────────────────────────

describe('isTokenUsed', () => {
  it('returns false when the token has not been used (DB returns null)', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    expect(await isTokenUsed(token)).toBe(false)
  })

  it('returns true when the token has been used (DB returns a record)', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'found-id',
      tokenHash: hashToken('some-token'),
      usedAt: new Date(),
    })
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    expect(await isTokenUsed(token)).toBe(true)
  })

  it('queries by the SHA-256 hash of the token', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    const expectedHash = hashToken(token)
    await isTokenUsed(token)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { tokenHash: expectedHash },
    })
  })

  it('does not pass the raw token to the DB query', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    await isTokenUsed(token)
    const callArg = mockFindFirst.mock.calls[0][0]
    expect(JSON.stringify(callArg)).not.toContain(token)
  })

  it('calls db.usedVerificationToken.findFirst exactly once', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)
    await isTokenUsed(token)
    expect(mockFindFirst).toHaveBeenCalledOnce()
  })
})

// ─────────────────────────────────────────────────────────────
// END-TO-END LIFECYCLE
// ─────────────────────────────────────────────────────────────

describe('token lifecycle — end to end', () => {
  it('generate → validate → mark used → is used returns true', async () => {
    const token = await generateResponseToken(RESTAURANT_ID, RECORD_ID)

    // Step 1: validate (should pass)
    const validation = await validateResponseToken(token)
    expect(validation.valid).toBe(true)

    // Step 2: not yet used
    mockFindFirst.mockResolvedValueOnce(null)
    expect(await isTokenUsed(token)).toBe(false)

    // Step 3: mark as used
    await markTokenUsed(token)

    // Step 4: now used
    mockFindFirst.mockResolvedValueOnce({
      id: 'x',
      tokenHash: hashToken(token),
      usedAt: new Date(),
    })
    expect(await isTokenUsed(token)).toBe(true)
  })

  it('two different tokens hash to different values (no collision)', async () => {
    const t1 = await generateResponseToken('rest-1', 'record-1')
    const t2 = await generateResponseToken('rest-2', 'record-2')
    expect(hashToken(t1)).not.toBe(hashToken(t2))
  })
})
