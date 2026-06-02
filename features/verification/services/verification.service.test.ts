// Verification Orchestrator Service — unit tests
//
// All sub-services and the DB client are mocked.
// This tests orchestration logic only — sequencing, error mapping, delegation.
// Sub-service correctness is covered by their own unit test files.
//
// Coverage goals:
//   ✓ State machine called first; rejection aborts before DB touch
//   ✓ Pre-flight fetch: NotFoundError when restaurant/record missing
//   ✓ approve: threshold gate (422 when score < 0.40)
//   ✓ approve: transaction writes correct fields; notification sent after commit
//   ✓ approve: returns { restaurantId, verificationStatus, confidenceScore }
//   ✓ reject: hard-zero score persisted; reason in event and internalNotes
//   ✓ requestInfo: token generated after commit; notification receives token
//   ✓ processSubmitterResponse: token validation failure (400)
//   ✓ processSubmitterResponse: token already used (410)
//   ✓ processSubmitterResponse: SYSTEM actor used for transition
//   ✓ processSubmitterResponse: token consumption inside transaction
//   ✓ processSubmitterResponse: photo records created inside transaction
//   ✓ assignAdmin: non-critical; no throw on DB failure

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VerificationStatus, UserRole } from '@prisma/client'
import {
  VerificationService,
  type ApproveParams,
  type RejectParams,
  type RequestInfoParams,
  type ProcessSubmitterResponseParams,
} from './verification.service'
import { ValidationError, NotFoundError, GoneError } from '@/lib/errors'

// ─────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────

// DB
vi.mock('@/lib/db', () => ({
  db: {},
  dbForVerification: {
    restaurant: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    verificationRecord: {
      update: vi.fn(),
    },
    verificationEvent: {
      create: vi.fn(),
    },
    usedVerificationToken: {
      create:    vi.fn(),
      findFirst: vi.fn(),
    },
    restaurantPhoto: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// State machine
vi.mock('./state-machine', () => ({
  validateTransition: vi.fn(),
}))

// Confidence scoring
vi.mock('./confidence-score.service', () => ({
  calculateScore:             vi.fn(),
  evaluateApprovalThreshold:  vi.fn(),
  REJECTED_SCORE: 0,
}))

// Response token
vi.mock('./response-token.service', () => ({
  generateResponseToken: vi.fn(),
  validateResponseToken: vi.fn(),
  isTokenUsed:           vi.fn(),
  hashToken:             vi.fn(),
}))

// Notification
vi.mock('./notification.service', () => ({
  NotificationService: {
    sendApproval:             vi.fn(),
    sendRejection:            vi.fn(),
    sendNeedsInfo:            vi.fn(),
    sendIntakeConfirmation:   vi.fn(),
  },
}))

// ─────────────────────────────────────────────────────────────
// IMPORT MOCKED MODULES
// ─────────────────────────────────────────────────────────────

import { dbForVerification } from '@/lib/db'
import { validateTransition } from './state-machine'
import {
  calculateScore,
  evaluateApprovalThreshold,
} from './confidence-score.service'
import {
  generateResponseToken,
  validateResponseToken,
  isTokenUsed,
  hashToken,
} from './response-token.service'
import { NotificationService } from './notification.service'

const mockDb     = dbForVerification as any
const mockSM     = validateTransition as ReturnType<typeof vi.fn>
const mockCalc   = calculateScore as ReturnType<typeof vi.fn>
const mockThresh = evaluateApprovalThreshold as ReturnType<typeof vi.fn>
const mockGenTok = generateResponseToken as ReturnType<typeof vi.fn>
const mockValTok = validateResponseToken as ReturnType<typeof vi.fn>
const mockIsTok  = isTokenUsed as ReturnType<typeof vi.fn>
const mockHash   = hashToken as ReturnType<typeof vi.fn>
const mockNotify = NotificationService as any

// ─────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────

const RESTAURANT_ID    = 'rest-uuid-001'
const RECORD_ID        = 'rec-uuid-001'
const ADMIN_ID         = 'admin-uuid-001'
const IP               = '1.2.3.4'
const REASON           = 'Does not meet photo quality requirements'
const FEEDBACK         = 'Please provide clearer photos'
const RESPONSE_TOKEN   = 'hdr.pld.sig'
const TOKEN_HASH       = 'abc123hash'
const SCORE            = 0.75
const BREAKDOWN        = { S1_phoneValid: 0.20, total: 0.75, calculatedAt: '2026-06-02T00:00:00Z', trigger: 'STATUS_TRANSITION' }

const MOCK_RESTAURANT = {
  id:                 RESTAURANT_ID,
  name:               'Mama Titi Kitchen',
  phone:              '08012345678',
  description:        'A wonderful restaurant with 50+ character description here.',
  address:            '12 Herbert Macaulay Way, Lagos',
  website:            'https://mamatiti.com',
  email:              null,
  verificationStatus: VerificationStatus.PENDING_REVIEW,
  confidenceScore:    { toNumber: () => 0.5 },
  dishes:             [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }],
  photos:             [{ id: 'p1', isVerified: true }],
  verification: {
    id:              RECORD_ID,
    submitterEmail:  'submitter@example.com',
    internalNotes:   null,
    currentStatus:   VerificationStatus.PENDING_REVIEW,
    confidenceScore: { toNumber: () => 0.5 },
  },
}

const MOCK_UPDATED_RESTAURANT = {
  ...MOCK_RESTAURANT,
  verificationStatus: VerificationStatus.APPROVED,
  confidenceScore:    { toNumber: () => SCORE },
}

// ─────────────────────────────────────────────────────────────
// SHARED SETUP
// ─────────────────────────────────────────────────────────────

function setupHappyPath() {
  mockDb.restaurant.findFirst.mockResolvedValue(MOCK_RESTAURANT)
  mockDb.restaurant.update.mockResolvedValue(MOCK_UPDATED_RESTAURANT)
  mockDb.verificationRecord.update.mockResolvedValue({})
  mockDb.verificationEvent.create.mockResolvedValue({ id: 'evt-001' })
  mockDb.usedVerificationToken.create.mockResolvedValue({})
  mockDb.restaurantPhoto.create.mockResolvedValue({})
  mockDb.$transaction.mockImplementation((ops: any[]) => Promise.all(ops))
  mockSM.mockReturnValue({ allowed: true })
  mockCalc.mockReturnValue({ score: SCORE, breakdown: BREAKDOWN })
  mockThresh.mockReturnValue({ passes: true, simulatedScore: SCORE })
  mockGenTok.mockResolvedValue(RESPONSE_TOKEN)
  mockValTok.mockResolvedValue({ valid: true, payload: { restaurantId: RESTAURANT_ID, verificationRecordId: RECORD_ID, iat: 1, exp: 9999999999 } })
  mockIsTok.mockResolvedValue(false)
  mockHash.mockReturnValue(TOKEN_HASH)
  Object.values(mockNotify).forEach((fn: any) => fn.mockResolvedValue(undefined))
}

const APPROVE_PARAMS: ApproveParams = {
  restaurantId: RESTAURANT_ID,
  actorId:      ADMIN_ID,
  actorRole:    UserRole.ADMIN,
  ipAddress:    IP,
}

const REJECT_PARAMS: RejectParams = {
  restaurantId: RESTAURANT_ID,
  actorId:      ADMIN_ID,
  actorRole:    UserRole.ADMIN,
  ipAddress:    IP,
  reason:       REASON,
}

const REQUEST_INFO_PARAMS: RequestInfoParams = {
  restaurantId:        RESTAURANT_ID,
  actorId:             ADMIN_ID,
  actorRole:           UserRole.ADMIN,
  ipAddress:           IP,
  feedbackToSubmitter: FEEDBACK,
}

const RESPONSE_PARAMS: ProcessSubmitterResponseParams = {
  token:        RESPONSE_TOKEN,
  responseText: 'Here are the additional details you requested.',
  ipAddress:    IP,
}

beforeEach(() => {
  process.env.NEXTAUTH_SECRET       = 'test-secret-at-least-32-chars-long!!'
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
  setupHappyPath()
})

afterEach(() => {
  delete process.env.NEXTAUTH_SECRET
  delete process.env.CLOUDINARY_CLOUD_NAME
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────
// SHARED: pre-flight and state machine
// ─────────────────────────────────────────────────────────────

describe('pre-flight: restaurant not found', () => {
  it('approve throws NotFoundError when restaurant is null', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(VerificationService.approve(APPROVE_PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('reject throws NotFoundError when restaurant is null', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(VerificationService.reject(REJECT_PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('requestInfo throws NotFoundError when restaurant is null', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(VerificationService.requestInfo(REQUEST_INFO_PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('approve throws NotFoundError when verification record is missing', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue({ ...MOCK_RESTAURANT, verification: null })
    await expect(VerificationService.approve(APPROVE_PARAMS)).rejects.toThrow(NotFoundError)
  })
})

describe('state machine: rejection aborts before DB', () => {
  it('approve throws ValidationError and does not open transaction', async () => {
    mockSM.mockReturnValue({ allowed: false, code: 'INVALID_TRANSITION', reason: 'forbidden' })
    await expect(VerificationService.approve(APPROVE_PARAMS)).rejects.toThrow(ValidationError)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('reject throws ValidationError and does not open transaction', async () => {
    mockSM.mockReturnValue({ allowed: false, code: 'UNAUTHORIZED_ACTOR', reason: 'bad actor' })
    await expect(VerificationService.reject(REJECT_PARAMS)).rejects.toThrow(ValidationError)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('requestInfo throws ValidationError and does not open transaction', async () => {
    mockSM.mockReturnValue({ allowed: false, code: 'INVALID_TRANSITION', reason: 'forbidden' })
    await expect(VerificationService.requestInfo(REQUEST_INFO_PARAMS)).rejects.toThrow(ValidationError)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('state machine is called with current status, target status, and actor role', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    expect(mockSM).toHaveBeenCalledWith(
      VerificationStatus.PENDING_REVIEW,
      VerificationStatus.APPROVED,
      UserRole.ADMIN,
    )
  })
})

// ─────────────────────────────────────────────────────────────
// approve
// ─────────────────────────────────────────────────────────────

describe('approve', () => {
  it('throws ValidationError when threshold check fails (score < 0.40)', async () => {
    mockThresh.mockReturnValue({ passes: false, simulatedScore: 0.30, code: 'SCORE_BELOW_THRESHOLD' })
    await expect(VerificationService.approve(APPROVE_PARAMS)).rejects.toThrow(ValidationError)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('evaluateApprovalThreshold is called before transaction opens', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    const thresholdCallOrder  = mockThresh.mock.invocationCallOrder[0]
    const transactionCallOrder = mockDb.$transaction.mock.invocationCallOrder[0]
    expect(thresholdCallOrder).toBeLessThan(transactionCallOrder)
  })

  it('opens exactly one transaction', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('transaction includes restaurant.update with APPROVED status and score', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RESTAURANT_ID },
      data: expect.objectContaining({
        verificationStatus: VerificationStatus.APPROVED,
        confidenceScore:    SCORE,
      }),
    }))
  })

  it('transaction includes verificationRecord.update with null assignedTo', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantId: RESTAURANT_ID },
      data: expect.objectContaining({
        currentStatus:   VerificationStatus.APPROVED,
        confidenceScore: SCORE,
        assignedTo:      null,
      }),
    }))
  })

  it('transaction includes verificationEvent.create with correct fields', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    expect(mockDb.verificationEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        verificationRecordId: RECORD_ID,
        restaurantId:         RESTAURANT_ID,
        fromStatus:           VerificationStatus.PENDING_REVIEW,
        toStatus:             VerificationStatus.APPROVED,
        actorId:              ADMIN_ID,
        actorRole:            UserRole.ADMIN,
        ipAddress:            IP,
      }),
    }))
  })

  it('notification is called after transaction commits', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    const txOrder     = mockDb.$transaction.mock.invocationCallOrder[0]
    const notifyOrder = (mockNotify.sendApproval as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(notifyOrder).toBeGreaterThan(txOrder)
  })

  it('sendApproval receives correct arguments', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    expect(mockNotify.sendApproval).toHaveBeenCalledWith({
      to:             MOCK_RESTAURANT.verification.submitterEmail,
      restaurantName: MOCK_RESTAURANT.name,
    })
  })

  it('returns restaurantId, verificationStatus, and confidenceScore', async () => {
    const result = await VerificationService.approve(APPROVE_PARAMS)
    expect(result.restaurantId).toBe(RESTAURANT_ID)
    expect(result.verificationStatus).toBe(VerificationStatus.APPROVED)
    expect(typeof result.confidenceScore).toBe('number')
  })

  it('internalNotes written to record when notes param provided', async () => {
    await VerificationService.approve({ ...APPROVE_PARAMS, notes: 'Admin note here' })
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ internalNotes: 'Admin note here' }),
    }))
  })
})

// ─────────────────────────────────────────────────────────────
// reject
// ─────────────────────────────────────────────────────────────

describe('reject', () => {
  it('opens exactly one transaction', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('persists REJECTED_SCORE (0) to restaurant, not the calculated score', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ confidenceScore: 0 }),
    }))
  })

  it('persists REJECTED_SCORE (0) to verificationRecord', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ confidenceScore: 0 }),
    }))
  })

  it('reason written to internalNotes', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ internalNotes: REASON }),
    }))
  })

  it('reason written to verificationEvent.reason', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockDb.verificationEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reason: REASON }),
    }))
  })

  it('verificationStatus set to REJECTED', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ verificationStatus: VerificationStatus.REJECTED }),
    }))
  })

  it('assignedTo set to null', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignedTo: null }),
    }))
  })

  it('sendRejection called with reason as feedbackToSubmitter', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    expect(mockNotify.sendRejection).toHaveBeenCalledWith({
      to:                  MOCK_RESTAURANT.verification.submitterEmail,
      restaurantName:      MOCK_RESTAURANT.name,
      feedbackToSubmitter: REASON,
    })
  })

  it('returns void', async () => {
    const result = await VerificationService.reject(REJECT_PARAMS)
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// requestInfo
// ─────────────────────────────────────────────────────────────

describe('requestInfo', () => {
  it('opens exactly one transaction', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('feedbackToSubmitter written to verificationRecord', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ feedbackToSubmitter: FEEDBACK }),
    }))
  })

  it('verificationStatus set to NEEDS_INFO', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ verificationStatus: VerificationStatus.NEEDS_INFO }),
    }))
  })

  it('generateResponseToken called after transaction commits', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    const txOrder    = mockDb.$transaction.mock.invocationCallOrder[0]
    const tokenOrder = mockGenTok.mock.invocationCallOrder[0]
    expect(tokenOrder).toBeGreaterThan(txOrder)
  })

  it('generateResponseToken called with restaurantId and verificationRecordId', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    expect(mockGenTok).toHaveBeenCalledWith(RESTAURANT_ID, RECORD_ID)
  })

  it('sendNeedsInfo called with token and feedbackToSubmitter', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    expect(mockNotify.sendNeedsInfo).toHaveBeenCalledWith({
      to:                  MOCK_RESTAURANT.verification.submitterEmail,
      restaurantName:      MOCK_RESTAURANT.name,
      feedbackToSubmitter: FEEDBACK,
      responseToken:       RESPONSE_TOKEN,
    })
  })

  it('notification called after token generation', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    const tokenOrder  = mockGenTok.mock.invocationCallOrder[0]
    const notifyOrder = (mockNotify.sendNeedsInfo as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(notifyOrder).toBeGreaterThan(tokenOrder)
  })

  it('returns void', async () => {
    const result = await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// processSubmitterResponse
// ─────────────────────────────────────────────────────────────

describe('processSubmitterResponse', () => {
  it('throws ValidationError when token is expired', async () => {
    mockValTok.mockResolvedValue({ valid: false, reason: 'EXPIRED' })
    await expect(VerificationService.processSubmitterResponse(RESPONSE_PARAMS))
      .rejects.toThrow(ValidationError)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('throws ValidationError when token is malformed', async () => {
    mockValTok.mockResolvedValue({ valid: false, reason: 'MALFORMED' })
    await expect(VerificationService.processSubmitterResponse(RESPONSE_PARAMS))
      .rejects.toThrow(ValidationError)
  })

  it('throws GoneError when token has already been used', async () => {
    mockIsTok.mockResolvedValue(true)
    await expect(VerificationService.processSubmitterResponse(RESPONSE_PARAMS))
      .rejects.toThrow(GoneError)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('token validation occurs before isTokenUsed check', async () => {
    mockValTok.mockResolvedValue({ valid: false, reason: 'MALFORMED' })
    await expect(VerificationService.processSubmitterResponse(RESPONSE_PARAMS)).rejects.toThrow()
    expect(mockIsTok).not.toHaveBeenCalled()
  })

  it('state machine called with SYSTEM actor', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockSM).toHaveBeenCalledWith(
      VerificationStatus.PENDING_REVIEW,
      VerificationStatus.PENDING_REVIEW,
      UserRole.SYSTEM,
    )
  })

  it('verificationEvent created with actorId SYSTEM and actorRole SYSTEM', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockDb.verificationEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId:   'SYSTEM',
        actorRole: UserRole.SYSTEM,
      }),
    }))
  })

  it('usedVerificationToken.create included in transaction', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockDb.usedVerificationToken.create).toHaveBeenCalledWith({
      data: { tokenHash: TOKEN_HASH },
    })
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
    const txOps = mockDb.$transaction.mock.calls[0][0]
    expect(txOps.length).toBeGreaterThanOrEqual(4)
  })

  it('hashToken called with the raw token to produce the stored hash', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockHash).toHaveBeenCalledWith(RESPONSE_TOKEN)
  })

  it('responseText written to internalNotes', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ internalNotes: RESPONSE_PARAMS.responseText }),
    }))
  })

  it('no notification sent (submitter response has no outbound email)', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockNotify.sendApproval).not.toHaveBeenCalled()
    expect(mockNotify.sendRejection).not.toHaveBeenCalled()
    expect(mockNotify.sendNeedsInfo).not.toHaveBeenCalled()
  })

  it('creates RestaurantPhoto records in transaction for each additionalPhotoId', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'chow-cloud'
    await VerificationService.processSubmitterResponse({
      ...RESPONSE_PARAMS,
      additionalPhotoIds: ['photo-public-id-1', 'photo-public-id-2'],
    })
    expect(mockDb.restaurantPhoto.create).toHaveBeenCalledTimes(2)
    expect(mockDb.restaurantPhoto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        isVerified:   false,
        isPrimary:    false,
        url: expect.stringContaining('photo-public-id-1'),
      }),
    }))
  })

  it('photo URL contains Cloudinary cloud name and public ID', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'my-cloud'
    await VerificationService.processSubmitterResponse({
      ...RESPONSE_PARAMS,
      additionalPhotoIds: ['img123'],
    })
    const [[call]] = mockDb.restaurantPhoto.create.mock.calls
    expect(call.data.url).toBe('https://res.cloudinary.com/my-cloud/image/upload/img123')
  })

  it('photo creates are inside the same transaction as the status change', async () => {
    await VerificationService.processSubmitterResponse({
      ...RESPONSE_PARAMS,
      additionalPhotoIds: ['p1', 'p2'],
    })
    const txOps = mockDb.$transaction.mock.calls[0][0]
    // 4 base ops + 2 photos = 6
    expect(txOps).toHaveLength(6)
  })

  it('no photo creates when additionalPhotoIds is absent', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockDb.restaurantPhoto.create).not.toHaveBeenCalled()
  })

  it('verificationStatus set to PENDING_REVIEW', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ verificationStatus: VerificationStatus.PENDING_REVIEW }),
    }))
  })

  it('returns void', async () => {
    const result = await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// assignAdmin
// ─────────────────────────────────────────────────────────────

describe('assignAdmin', () => {
  it('calls verificationRecord.update with adminId', async () => {
    mockDb.verificationRecord.update.mockResolvedValue({})
    await VerificationService.assignAdmin({ restaurantId: RESTAURANT_ID, adminId: ADMIN_ID })
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT_ID },
      data:  { assignedTo: ADMIN_ID },
    })
  })

  it('does not open a transaction', async () => {
    mockDb.verificationRecord.update.mockResolvedValue({})
    await VerificationService.assignAdmin({ restaurantId: RESTAURANT_ID, adminId: ADMIN_ID })
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('does not throw when DB update fails (non-critical)', async () => {
    mockDb.verificationRecord.update.mockRejectedValue(new Error('DB error'))
    await expect(
      VerificationService.assignAdmin({ restaurantId: RESTAURANT_ID, adminId: ADMIN_ID }),
    ).resolves.toBeUndefined()
  })

  it('returns void', async () => {
    mockDb.verificationRecord.update.mockResolvedValue({})
    const result = await VerificationService.assignAdmin({ restaurantId: RESTAURANT_ID, adminId: ADMIN_ID })
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// Score calculation: target status passed to calculator
// ─────────────────────────────────────────────────────────────

describe('score calculation: target status substitution', () => {
  it('approve passes APPROVED as verificationStatus to calculateScore', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verificationStatus).toBe(VerificationStatus.APPROVED)
  })

  it('reject passes REJECTED as verificationStatus to calculateScore', async () => {
    await VerificationService.reject(REJECT_PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verificationStatus).toBe(VerificationStatus.REJECTED)
  })

  it('requestInfo passes NEEDS_INFO as verificationStatus to calculateScore', async () => {
    await VerificationService.requestInfo(REQUEST_INFO_PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verificationStatus).toBe(VerificationStatus.NEEDS_INFO)
  })

  it('processSubmitterResponse passes PENDING_REVIEW to calculateScore', async () => {
    await VerificationService.processSubmitterResponse(RESPONSE_PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verificationStatus).toBe(VerificationStatus.PENDING_REVIEW)
  })

  it('calculateScore called with STATUS_TRANSITION trigger', async () => {
    await VerificationService.approve(APPROVE_PARAMS)
    expect(mockCalc).toHaveBeenCalledWith(expect.anything(), 'STATUS_TRANSITION')
  })
})
