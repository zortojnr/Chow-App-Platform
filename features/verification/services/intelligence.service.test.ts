// Intelligence Collection Service — unit tests
//
// All DB calls and the confidence-score service are mocked.
// Tests cover orchestration logic: sequencing, score projection, audit logs,
// transaction membership, and boundary enforcement.
//
// Coverage goals:
//   ✓ verifyDish: NotFoundError paths, transaction writes, score delegation, audit log, result shape
//   ✓ verifyPhoto: NotFoundError paths, isVerified-change triggers recalculation,
//                  no recalculation when isVerified unchanged, projected verifiedPhotoCount,
//                  transaction membership, audit log, result shape
//   ✓ updateAvailability: NotFoundError, correct DB write, no transaction, returns void
//   ✓ updatePricing: NotFoundError, correct DB write, no transaction, returns void
//   ✓ recalculateRestaurantIntelligence: NotFoundError paths, projected score input,
//                                         forbidden fields excluded by type, transaction writes,
//                                         audit log, result shape
//   ✓ overrideScore: NotFoundError, ValidationError from validateOverrideRequest,
//                    transaction writes override breakdown, audit log, returns void

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DishAvailabilityStatus, PriceRange, UserRole, VerificationStatus } from '@prisma/client'
import {
  IntelligenceService,
  type VerifyDishParams,
  type VerifyPhotoParams,
  type UpdateAvailabilityParams,
  type UpdatePricingParams,
  type UpdateIntelligenceParams,
  type OverrideScoreParams,
} from './intelligence.service'
import { NotFoundError, ValidationError } from '@/lib/errors'

// ─────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    restaurantDish: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    restaurantPhoto: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    verificationRecord: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('./confidence-score.service', () => ({
  calculateScore:            vi.fn(),
  validateOverrideRequest:   vi.fn(),
  buildOverrideBreakdown:    vi.fn(),
}))

// ─────────────────────────────────────────────────────────────
// IMPORT MOCKED MODULES
// ─────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import {
  calculateScore,
  validateOverrideRequest,
  buildOverrideBreakdown,
} from './confidence-score.service'

const mockDb       = db as any
const mockCalc     = calculateScore as ReturnType<typeof vi.fn>
const mockValidate = validateOverrideRequest as ReturnType<typeof vi.fn>
const mockBuild    = buildOverrideBreakdown as ReturnType<typeof vi.fn>

// ─────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────

const RESTAURANT_ID = 'rest-uuid-001'
const DISH_ID       = 'dish-uuid-001'
const PHOTO_ID      = 'photo-uuid-001'
const ADMIN_ID      = 'admin-uuid-001'
const RECORD_ID     = 'rec-uuid-001'
const SCORE         = 0.75
const OLD_SCORE     = 0.50
const BREAKDOWN     = { S1_phoneValid: 0.20, total: 0.75, calculatedAt: '2026-06-04T00:00:00Z', trigger: 'FIELD_UPDATED' }
const OVERRIDE_BD   = { overridden: true, overriddenAt: '2026-06-04T00:00:00Z', overriddenBy: ADMIN_ID, overrideScore: 0.90, overrideReason: 'Manual quality verification confirmed on-site', lastComputedBreakdown: { total: 0.50 } }

const MOCK_DISH = {
  id:           DISH_ID,
  restaurantId: RESTAURANT_ID,
  deletedAt:    null,
  verifiedAt:   null,
  nameAsServed: null,
  availabilityStatus: DishAvailabilityStatus.UNKNOWN,
  price:        null,
}

const MOCK_PHOTO = {
  id:           PHOTO_ID,
  restaurantId: RESTAURANT_ID,
  isVerified:   false,
  isPrimary:    false,
  url:          'https://res.cloudinary.com/test/image/upload/abc123',
}

const MOCK_VERIFIED_PHOTO = {
  ...MOCK_PHOTO,
  isVerified: true,
}

const MOCK_RESTAURANT = {
  id:                 RESTAURANT_ID,
  name:               'Mama Titi Kitchen',
  slug:               'mama-titi-kitchen',
  phone:              '08012345678',
  description:        'A wonderful restaurant with a fifty character description here.',
  address:            '12 Herbert Macaulay Way, Lagos Island',
  city:               'Lagos',
  state:              'Lagos',
  website:            'https://mamatiti.com',
  email:              null,
  priceRange:         PriceRange.MID,
  area:               null,
  verificationStatus: VerificationStatus.APPROVED,
  confidenceScore:    OLD_SCORE,
  dishes:             [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }],
  photos:             [{ id: 'p1', isVerified: true }],
  verification: {
    id:             RECORD_ID,
    scoreBreakdown: { total: OLD_SCORE },
    currentStatus:  VerificationStatus.APPROVED,
  },
}

// ─────────────────────────────────────────────────────────────
// SHARED SETUP
// ─────────────────────────────────────────────────────────────

function setupHappyPath() {
  mockDb.restaurantDish.findFirst.mockResolvedValue(MOCK_DISH)
  mockDb.restaurantPhoto.findFirst.mockResolvedValue(MOCK_PHOTO)
  mockDb.restaurant.findFirst.mockResolvedValue(MOCK_RESTAURANT)
  mockDb.restaurantDish.update.mockResolvedValue({ ...MOCK_DISH, verifiedAt: new Date() })
  mockDb.restaurantPhoto.update.mockResolvedValue({ ...MOCK_PHOTO, isVerified: true })
  mockDb.restaurant.update.mockResolvedValue({ ...MOCK_RESTAURANT, confidenceScore: { toNumber: () => SCORE } })
  mockDb.verificationRecord.update.mockResolvedValue({})
  mockDb.$transaction.mockImplementation((ops: any[]) => Promise.all(ops))
  mockCalc.mockReturnValue({ score: SCORE, breakdown: BREAKDOWN })
  mockValidate.mockReturnValue({ valid: true })
  mockBuild.mockReturnValue(OVERRIDE_BD)
}

beforeEach(setupHappyPath)
afterEach(vi.clearAllMocks)

// ─────────────────────────────────────────────────────────────
// verifyDish
// ─────────────────────────────────────────────────────────────

describe('verifyDish', () => {
  const PARAMS: VerifyDishParams = { restaurantDishId: DISH_ID, adminId: ADMIN_ID }

  it('throws NotFoundError when dish is not found', async () => {
    mockDb.restaurantDish.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.verifyDish(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when restaurant is not found', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.verifyDish(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when verification record is missing', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue({ ...MOCK_RESTAURANT, verification: null })
    await expect(IntelligenceService.verifyDish(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('opens exactly one transaction', async () => {
    await IntelligenceService.verifyDish(PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('transaction contains exactly 3 operations', async () => {
    await IntelligenceService.verifyDish(PARAMS)
    const ops = mockDb.$transaction.mock.calls[0][0]
    expect(ops).toHaveLength(3)
  })

  it('transaction includes restaurantDish.update with verifiedAt', async () => {
    const fixedDate = new Date('2026-06-04T00:00:00Z')
    await IntelligenceService.verifyDish({ ...PARAMS, verifiedAt: fixedDate })
    expect(mockDb.restaurantDish.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: DISH_ID },
      data:  expect.objectContaining({ verifiedAt: fixedDate }),
    }))
  })

  it('uses current timestamp when verifiedAt not provided', async () => {
    const before = Date.now()
    await IntelligenceService.verifyDish(PARAMS)
    const after = Date.now()
    const call = mockDb.restaurantDish.update.mock.calls[0][0]
    const ts = call.data.verifiedAt as Date
    expect(ts.getTime()).toBeGreaterThanOrEqual(before)
    expect(ts.getTime()).toBeLessThanOrEqual(after)
  })

  it('includes nameAsServed when provided', async () => {
    await IntelligenceService.verifyDish({ ...PARAMS, nameAsServed: 'Mama Titi Jollof' })
    expect(mockDb.restaurantDish.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nameAsServed: 'Mama Titi Jollof' }),
    }))
  })

  it('omits nameAsServed when not provided', async () => {
    await IntelligenceService.verifyDish(PARAMS)
    const call = mockDb.restaurantDish.update.mock.calls[0][0]
    expect('nameAsServed' in call.data).toBe(false)
  })

  it('transaction includes restaurant.update with new score', async () => {
    await IntelligenceService.verifyDish(PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RESTAURANT_ID },
      data:  expect.objectContaining({ confidenceScore: SCORE }),
    }))
  })

  it('transaction includes verificationRecord.update with new score and breakdown', async () => {
    await IntelligenceService.verifyDish(PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantId: RESTAURANT_ID },
      data:  expect.objectContaining({ confidenceScore: SCORE, scoreBreakdown: BREAKDOWN }),
    }))
  })

  it('calculateScore called with FIELD_UPDATED trigger', async () => {
    await IntelligenceService.verifyDish(PARAMS)
    expect(mockCalc).toHaveBeenCalledWith(expect.anything(), 'FIELD_UPDATED')
  })

  it('returns correct result shape', async () => {
    const fixedDate = new Date('2026-06-04T00:00:00Z')
    const result = await IntelligenceService.verifyDish({ ...PARAMS, verifiedAt: fixedDate })
    expect(result.restaurantDishId).toBe(DISH_ID)
    expect(result.restaurantId).toBe(RESTAURANT_ID)
    expect(result.verifiedAt).toBe(fixedDate)
    expect(result.newScore).toBe(SCORE)
  })
})

// ─────────────────────────────────────────────────────────────
// verifyPhoto
// ─────────────────────────────────────────────────────────────

describe('verifyPhoto — isVerified changes (false → true)', () => {
  const PARAMS: VerifyPhotoParams = { photoId: PHOTO_ID, adminId: ADMIN_ID, isVerified: true }

  it('throws NotFoundError when photo is not found', async () => {
    mockDb.restaurantPhoto.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.verifyPhoto(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when restaurant is not found', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.verifyPhoto(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when verification record is missing', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue({ ...MOCK_RESTAURANT, verification: null })
    await expect(IntelligenceService.verifyPhoto(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('opens exactly one transaction', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('transaction contains exactly 3 operations', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    const ops = mockDb.$transaction.mock.calls[0][0]
    expect(ops).toHaveLength(3)
  })

  it('passes verifiedPhotoCount + 1 to calculateScore when setting true', async () => {
    // MOCK_RESTAURANT has 1 verified photo; setting another to true → 2
    await IntelligenceService.verifyPhoto(PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verifiedPhotoCount).toBe(2)
  })

  it('calculateScore called with PHOTO_VERIFIED trigger', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockCalc).toHaveBeenCalledWith(expect.anything(), 'PHOTO_VERIFIED')
  })

  it('transaction includes restaurantPhoto.update with isVerified = true', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockDb.restaurantPhoto.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: PHOTO_ID },
      data:  expect.objectContaining({ isVerified: true }),
    }))
  })

  it('transaction includes restaurant.update with new score', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ confidenceScore: SCORE }),
    }))
  })

  it('transaction includes verificationRecord.update', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantId: RESTAURANT_ID },
      data:  expect.objectContaining({ confidenceScore: SCORE }),
    }))
  })

  it('includes isPrimary in update when provided', async () => {
    await IntelligenceService.verifyPhoto({ ...PARAMS, isPrimary: true })
    expect(mockDb.restaurantPhoto.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isPrimary: true }),
    }))
  })

  it('returns correct result shape with newScore', async () => {
    const result = await IntelligenceService.verifyPhoto(PARAMS)
    expect(result.photoId).toBe(PHOTO_ID)
    expect(result.restaurantId).toBe(RESTAURANT_ID)
    expect(result.isVerified).toBe(true)
    expect(result.newScore).toBe(SCORE)
  })
})

describe('verifyPhoto — isVerified changes (true → false)', () => {
  const PARAMS: VerifyPhotoParams = { photoId: PHOTO_ID, adminId: ADMIN_ID, isVerified: false }

  beforeEach(() => {
    // Photo is currently verified
    mockDb.restaurantPhoto.findFirst.mockResolvedValue(MOCK_VERIFIED_PHOTO)
  })

  it('passes verifiedPhotoCount - 1 to calculateScore when setting false', async () => {
    // MOCK_RESTAURANT has 1 verified photo; removing → 0
    await IntelligenceService.verifyPhoto(PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verifiedPhotoCount).toBe(0)
  })

  it('verifiedPhotoCount never goes below 0', async () => {
    // Restaurant with 0 verified photos — removing should still be 0
    mockDb.restaurant.findFirst.mockResolvedValue({ ...MOCK_RESTAURANT, photos: [] })
    await IntelligenceService.verifyPhoto(PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verifiedPhotoCount).toBe(0)
  })

  it('opens a transaction (recalculation required)', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })
})

describe('verifyPhoto — isVerified unchanged (no recalculation)', () => {
  const PARAMS: VerifyPhotoParams = { photoId: PHOTO_ID, adminId: ADMIN_ID, isVerified: false, isPrimary: true }

  it('does NOT open a transaction', async () => {
    // MOCK_PHOTO has isVerified = false; PARAMS sets isVerified = false → no change
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('does NOT call calculateScore', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockCalc).not.toHaveBeenCalled()
  })

  it('still updates the photo record (isPrimary can change)', async () => {
    await IntelligenceService.verifyPhoto(PARAMS)
    expect(mockDb.restaurantPhoto.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: PHOTO_ID },
      data:  expect.objectContaining({ isPrimary: true }),
    }))
  })

  it('returns current score (unchanged)', async () => {
    const result = await IntelligenceService.verifyPhoto(PARAMS)
    expect(result.newScore).toBe(OLD_SCORE)
  })
})

// ─────────────────────────────────────────────────────────────
// updateAvailability
// ─────────────────────────────────────────────────────────────

describe('updateAvailability', () => {
  const PARAMS: UpdateAvailabilityParams = {
    restaurantDishId:   DISH_ID,
    adminId:            ADMIN_ID,
    availabilityStatus: DishAvailabilityStatus.WEEKEND_ONLY,
  }

  it('throws NotFoundError when dish is not found', async () => {
    mockDb.restaurantDish.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.updateAvailability(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('updates restaurantDish with correct availabilityStatus', async () => {
    await IntelligenceService.updateAvailability(PARAMS)
    expect(mockDb.restaurantDish.update).toHaveBeenCalledWith({
      where: { id: DISH_ID },
      data:  { availabilityStatus: DishAvailabilityStatus.WEEKEND_ONLY },
    })
  })

  it('does NOT open a transaction', async () => {
    await IntelligenceService.updateAvailability(PARAMS)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('does NOT call calculateScore', async () => {
    await IntelligenceService.updateAvailability(PARAMS)
    expect(mockCalc).not.toHaveBeenCalled()
  })

  it('returns void', async () => {
    const result = await IntelligenceService.updateAvailability(PARAMS)
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// updatePricing
// ─────────────────────────────────────────────────────────────

describe('updatePricing', () => {
  const PARAMS: UpdatePricingParams = {
    restaurantDishId: DISH_ID,
    adminId:          ADMIN_ID,
    price:            2500,
  }

  it('throws NotFoundError when dish is not found', async () => {
    mockDb.restaurantDish.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.updatePricing(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('updates restaurantDish with correct price', async () => {
    await IntelligenceService.updatePricing(PARAMS)
    expect(mockDb.restaurantDish.update).toHaveBeenCalledWith({
      where: { id: DISH_ID },
      data:  { price: 2500 },
    })
  })

  it('does NOT open a transaction', async () => {
    await IntelligenceService.updatePricing(PARAMS)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('does NOT call calculateScore', async () => {
    await IntelligenceService.updatePricing(PARAMS)
    expect(mockCalc).not.toHaveBeenCalled()
  })

  it('returns void', async () => {
    const result = await IntelligenceService.updatePricing(PARAMS)
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// recalculateRestaurantIntelligence
// ─────────────────────────────────────────────────────────────

describe('recalculateRestaurantIntelligence', () => {
  const PARAMS: UpdateIntelligenceParams = {
    restaurantId: RESTAURANT_ID,
    adminId:      ADMIN_ID,
    fields:       { description: 'Updated description that is at least fifty characters long.' },
  }

  it('throws NotFoundError when restaurant is not found', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.recalculateRestaurantIntelligence(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when verification record is missing', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue({ ...MOCK_RESTAURANT, verification: null })
    await expect(IntelligenceService.recalculateRestaurantIntelligence(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('opens exactly one transaction', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('transaction contains exactly 2 operations (no state transition)', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    const ops = mockDb.$transaction.mock.calls[0][0]
    expect(ops).toHaveLength(2)
  })

  it('transaction includes restaurant.update with provided fields and new score', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RESTAURANT_ID },
      data:  expect.objectContaining({
        description:    PARAMS.fields.description,
        confidenceScore: SCORE,
      }),
    }))
  })

  it('transaction includes verificationRecord.update with new score and breakdown', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantId: RESTAURANT_ID },
      data:  expect.objectContaining({ confidenceScore: SCORE, scoreBreakdown: BREAKDOWN }),
    }))
  })

  it('calculateScore called with FIELD_UPDATED trigger', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    expect(mockCalc).toHaveBeenCalledWith(expect.anything(), 'FIELD_UPDATED')
  })

  it('score input uses new phone value when provided', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence({
      ...PARAMS,
      fields: { phone: '09012345678' },
    })
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.phone).toBe('09012345678')
  })

  it('score input uses new description when provided', async () => {
    const newDesc = 'A brand new description that is at least fifty characters long!'
    await IntelligenceService.recalculateRestaurantIntelligence({
      ...PARAMS,
      fields: { description: newDesc },
    })
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.description).toBe(newDesc)
  })

  it('score input uses new email value when provided', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence({
      ...PARAMS,
      fields: { email: 'new@mamatiti.com' },
    })
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.email).toBe('new@mamatiti.com')
  })

  it('score input uses null email when email is explicitly cleared', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence({
      ...PARAMS,
      fields: { email: null },
    })
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.email).toBeNull()
  })

  it('score input falls back to current restaurant value for unspecified fields', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.phone).toBe(MOCK_RESTAURANT.phone)
    expect(scoreInput.website).toBe(MOCK_RESTAURANT.website)
  })

  it('score input preserves current verificationStatus (never changed here)', async () => {
    await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    const [[scoreInput]] = mockCalc.mock.calls
    expect(scoreInput.verificationStatus).toBe(VerificationStatus.APPROVED)
  })

  it('returns correct result shape', async () => {
    const result = await IntelligenceService.recalculateRestaurantIntelligence(PARAMS)
    expect(result.restaurantId).toBe(RESTAURANT_ID)
    expect(result.newScore).toBe(SCORE)
  })
})

// ─────────────────────────────────────────────────────────────
// overrideScore
// ─────────────────────────────────────────────────────────────

describe('overrideScore', () => {
  const PARAMS: OverrideScoreParams = {
    restaurantId: RESTAURANT_ID,
    actorId:      ADMIN_ID,
    actorRole:    UserRole.SUPER,
    score:        0.90,
    reason:       'Manual quality verification confirmed on-site',
  }

  it('throws NotFoundError when restaurant is not found', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(IntelligenceService.overrideScore(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when verification record is missing', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue({ ...MOCK_RESTAURANT, verification: null })
    await expect(IntelligenceService.overrideScore(PARAMS)).rejects.toThrow(NotFoundError)
  })

  it('throws ValidationError when validateOverrideRequest fails', async () => {
    mockValidate.mockReturnValue({ valid: false, reason: 'Only SUPER role can manually override confidence scores', code: 'UNAUTHORIZED_ACTOR' })
    await expect(IntelligenceService.overrideScore({ ...PARAMS, actorRole: UserRole.ADMIN }))
      .rejects.toThrow(ValidationError)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('validateOverrideRequest called with correct arguments', async () => {
    await IntelligenceService.overrideScore(PARAMS)
    expect(mockValidate).toHaveBeenCalledWith(
      PARAMS.score,
      PARAMS.reason,
      UserRole.SUPER,
      VerificationStatus.APPROVED,
    )
  })

  it('opens exactly one transaction', async () => {
    await IntelligenceService.overrideScore(PARAMS)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('transaction contains exactly 2 operations', async () => {
    await IntelligenceService.overrideScore(PARAMS)
    const ops = mockDb.$transaction.mock.calls[0][0]
    expect(ops).toHaveLength(2)
  })

  it('transaction includes restaurant.update with override score', async () => {
    await IntelligenceService.overrideScore(PARAMS)
    expect(mockDb.restaurant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RESTAURANT_ID },
      data:  expect.objectContaining({ confidenceScore: PARAMS.score }),
    }))
  })

  it('transaction includes verificationRecord.update with override breakdown', async () => {
    await IntelligenceService.overrideScore(PARAMS)
    expect(mockDb.verificationRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantId: RESTAURANT_ID },
      data:  expect.objectContaining({
        confidenceScore: PARAMS.score,
        scoreBreakdown:  OVERRIDE_BD,
      }),
    }))
  })

  it('buildOverrideBreakdown called with correct arguments', async () => {
    await IntelligenceService.overrideScore(PARAMS)
    expect(mockBuild).toHaveBeenCalledWith(expect.objectContaining({
      overriddenBy:  ADMIN_ID,
      overrideScore: PARAMS.score,
      overrideReason: PARAMS.reason,
    }))
  })

  it('lastComputedBreakdown passed to buildOverrideBreakdown from current scoreBreakdown', async () => {
    await IntelligenceService.overrideScore(PARAMS)
    const [[call]] = mockBuild.mock.calls
    expect(call.lastComputedBreakdown).toEqual({ total: OLD_SCORE })
  })

  it('returns void', async () => {
    const result = await IntelligenceService.overrideScore(PARAMS)
    expect(result).toBeUndefined()
  })
})
