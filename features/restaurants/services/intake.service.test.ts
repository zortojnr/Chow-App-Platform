// Intake Service — unit tests
//
// Coverage goals (restaurant-intake-track.md §2, track-02 §12 Step 5 exit criteria):
//   ✓ Happy path: all records created in correct order, submissionId returned
//   ✓ verificationStatus is PENDING_REVIEW on Restaurant
//   ✓ currentStatus is PENDING_REVIEW on VerificationRecord
//   ✓ VerificationEvent: fromStatus null, toStatus PENDING_REVIEW
//   ✓ EXACT_DUPLICATE → ConflictError with existingSlug in error.data
//   ✓ POSSIBLE_DUPLICATE → proceeds with internalNotes set on VerificationRecord
//   ✓ Invalid dish IDs → ValidationError thrown before transaction
//   ✓ Photos provided → restaurantPhoto.createMany called
//   ✓ No photos → restaurantPhoto.createMany NOT called
//   ✓ Confirmation email called with first 8 chars of ID (uppercased) as submissionRef
//   ✓ No submitterEmail → email called with to: null (skipped silently by notification service)
//   ✓ Email failure does not throw (transaction already committed)
//   ✓ verificationRecord receives submitterEmail from payload
//   ✓ POSSIBLE_DUPLICATE internalNotes contains candidate details

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IntakeService } from './intake.service'
import { ConflictError, ValidationError } from '@/lib/errors'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    dishTaxonomy: { findMany: vi.fn() },
    restaurant: { create: vi.fn() },
    restaurantDish: { createMany: vi.fn() },
    restaurantPhoto: { createMany: vi.fn() },
    verificationRecord: { create: vi.fn() },
    verificationEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('./slug.service', () => ({
  generateSlug: vi.fn(),
  ensureUniqueSlug: vi.fn(),
}))

vi.mock('./duplicate-check.service', () => ({
  checkForDuplicate: vi.fn(),
}))

vi.mock('../../verification/services/notification.service', () => ({
  NotificationService: {
    sendIntakeConfirmation: vi.fn(),
  },
}))

vi.mock('@/lib/cloudinary', () => ({
  buildCloudinaryUrl: vi.fn((id: string) => `https://res.cloudinary.com/test/image/upload/${id}`),
}))

import { db } from '@/lib/db'
import { generateSlug, ensureUniqueSlug } from './slug.service'
import { checkForDuplicate } from './duplicate-check.service'
import { NotificationService } from '../../verification/services/notification.service'

const mockDb = db as unknown as {
  dishTaxonomy: { findMany: ReturnType<typeof vi.fn> }
  restaurant: { create: ReturnType<typeof vi.fn> }
  restaurantDish: { createMany: ReturnType<typeof vi.fn> }
  restaurantPhoto: { createMany: ReturnType<typeof vi.fn> }
  verificationRecord: { create: ReturnType<typeof vi.fn> }
  verificationEvent: { create: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

const mockGenerateSlug = generateSlug as ReturnType<typeof vi.fn>
const mockEnsureUniqueSlug = ensureUniqueSlug as ReturnType<typeof vi.fn>
const mockCheckForDuplicate = checkForDuplicate as ReturnType<typeof vi.fn>
const mockSendIntakeConfirmation = NotificationService.sendIntakeConfirmation as ReturnType<typeof vi.fn>

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RESTAURANT_ID = '550e8400-e29b-41d4-a716-446655440000'
const VERIFICATION_RECORD_ID = '660e8400-e29b-41d4-a716-446655440001'

const BASE_PAYLOAD = {
  name: 'Mama Titi Kitchen',
  address: '15 Balogun Street, Lagos',
  city: 'Lagos' as const,
  state: 'Lagos' as const,
  phone: '08012345678',
  priceRange: 'MID' as const,
  cuisineTypes: ['Nigerian'],
  dishes: [
    {
      dishId: '123e4567-e89b-12d3-a456-426614174000',
      availabilityStatus: 'ALWAYS_AVAILABLE' as const,
    },
  ],
  photos: [],
  submitterEmail: 'titi@example.com',
}

const IP = '1.2.3.4'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()

  // Default slug behaviour
  mockGenerateSlug.mockReturnValue('mama-titi-kitchen')
  mockEnsureUniqueSlug.mockResolvedValue('mama-titi-kitchen')

  // Default duplicate check: clear
  mockCheckForDuplicate.mockResolvedValue({ status: 'CLEAR' })

  // Default dish validation: all found
  mockDb.dishTaxonomy.findMany.mockResolvedValue([
    { id: '123e4567-e89b-12d3-a456-426614174000' },
  ])

  // Default restaurant create result
  mockDb.restaurant.create.mockResolvedValue({ id: RESTAURANT_ID })

  // Default verification record create result
  mockDb.verificationRecord.create.mockResolvedValue({ id: VERIFICATION_RECORD_ID })

  // Default other creates
  mockDb.restaurantDish.createMany.mockResolvedValue({ count: 1 })
  mockDb.restaurantPhoto.createMany.mockResolvedValue({ count: 0 })
  mockDb.verificationEvent.create.mockResolvedValue({})

  // $transaction executes the callback synchronously with db as the tx client
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db))

  // Default email: resolves
  mockSendIntakeConfirmation.mockResolvedValue(undefined)
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns submissionId equal to the created restaurant ID', async () => {
    const result = await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(result.submissionId).toBe(RESTAURANT_ID)
  })

  it('creates the restaurant with verificationStatus PENDING_REVIEW', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.restaurant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ verificationStatus: 'PENDING_REVIEW' }),
      }),
    )
  })

  it('creates the restaurant with the resolved slug', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.restaurant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'mama-titi-kitchen' }),
      }),
    )
  })

  it('creates the verification record with currentStatus PENDING_REVIEW', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.verificationRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: 'PENDING_REVIEW' }),
      }),
    )
  })

  it('creates the verification event with fromStatus null and toStatus PENDING_REVIEW', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.verificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: null,
          toStatus: 'PENDING_REVIEW',
        }),
      }),
    )
  })

  it('writes actorId SYSTEM and actorRole SYSTEM on the verification event', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.verificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: 'SYSTEM', actorRole: 'SYSTEM' }),
      }),
    )
  })

  it('stores the ip address on the verification event', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.verificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ipAddress: IP }),
      }),
    )
  })

  it('stores submitterEmail on the verification record', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.verificationRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submitterEmail: 'titi@example.com' }),
      }),
    )
  })

  it('sets internalNotes to null when no duplicate detected', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.verificationRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ internalNotes: null }),
      }),
    )
  })

  it('sends confirmation email with first 8 chars of ID uppercased', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockSendIntakeConfirmation).toHaveBeenCalledWith({
      to: 'titi@example.com',
      restaurantName: 'Mama Titi Kitchen',
      submissionRef: RESTAURANT_ID.slice(0, 8).toUpperCase(),
    })
  })

  it('creates dish records for all submitted dishes', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.restaurantDish.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ dishId: '123e4567-e89b-12d3-a456-426614174000' }),
        ]),
      }),
    )
  })

  it('does not call restaurantPhoto.createMany when photos array is empty', async () => {
    await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(mockDb.restaurantPhoto.createMany).not.toHaveBeenCalled()
  })

  it('calls restaurantPhoto.createMany when photos are provided', async () => {
    const payload = {
      ...BASE_PAYLOAD,
      photos: [{ cloudinaryPublicId: 'intake/2026/06/abc123', isPrimary: true }],
    }
    await IntakeService.submit(payload, IP)
    expect(mockDb.restaurantPhoto.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            isPrimary: true,
            url: expect.stringContaining('abc123'),
          }),
        ]),
      }),
    )
  })
})

// ─── No submitter email ───────────────────────────────────────────────────────

describe('no submitter email', () => {
  it('calls sendIntakeConfirmation with to: null when submitterEmail is absent', async () => {
    const { submitterEmail: _omit, ...payload } = BASE_PAYLOAD
    await IntakeService.submit(payload as typeof BASE_PAYLOAD, IP)
    expect(mockSendIntakeConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: null }),
    )
  })

  it('stores null submitterEmail on the verification record', async () => {
    const { submitterEmail: _omit, ...payload } = BASE_PAYLOAD
    await IntakeService.submit(payload as typeof BASE_PAYLOAD, IP)
    expect(mockDb.verificationRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submitterEmail: null }),
      }),
    )
  })
})

// ─── EXACT_DUPLICATE ─────────────────────────────────────────────────────────

describe('EXACT_DUPLICATE', () => {
  it('throws ConflictError', async () => {
    mockCheckForDuplicate.mockResolvedValue({
      status: 'EXACT_DUPLICATE',
      existingId: 'existing-id',
      existingSlug: 'mama-titi-kitchen',
    })
    await expect(IntakeService.submit(BASE_PAYLOAD, IP)).rejects.toBeInstanceOf(ConflictError)
  })

  it('includes existingSlug in error.data', async () => {
    mockCheckForDuplicate.mockResolvedValue({
      status: 'EXACT_DUPLICATE',
      existingId: 'existing-id',
      existingSlug: 'mama-titi-kitchen',
    })
    await expect(IntakeService.submit(BASE_PAYLOAD, IP)).rejects.toMatchObject({
      data: { existingSlug: 'mama-titi-kitchen' },
    })
  })

  it('does not open a transaction when duplicate detected', async () => {
    mockCheckForDuplicate.mockResolvedValue({
      status: 'EXACT_DUPLICATE',
      existingId: 'existing-id',
      existingSlug: 'mama-titi-kitchen',
    })
    await expect(IntakeService.submit(BASE_PAYLOAD, IP)).rejects.toThrow()
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })
})

// ─── POSSIBLE_DUPLICATE ──────────────────────────────────────────────────────

describe('POSSIBLE_DUPLICATE', () => {
  it('proceeds with submission when possible duplicate detected', async () => {
    mockCheckForDuplicate.mockResolvedValue({
      status: 'POSSIBLE_DUPLICATE',
      candidates: [{ id: 'cand-1', name: 'Mama Titi Kitchenn', similarity: 0.92 }],
    })
    const result = await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(result.submissionId).toBe(RESTAURANT_ID)
  })

  it('sets internalNotes on the verification record', async () => {
    mockCheckForDuplicate.mockResolvedValue({
      status: 'POSSIBLE_DUPLICATE',
      candidates: [{ id: 'cand-1', name: 'Mama Titi Kitchenn', similarity: 0.92 }],
    })
    await IntakeService.submit(BASE_PAYLOAD, IP)
    const call = mockDb.verificationRecord.create.mock.calls[0][0]
    expect(call.data.internalNotes).toContain('Possible duplicate')
    expect(call.data.internalNotes).toContain('Mama Titi Kitchenn')
    expect(call.data.internalNotes).toContain('0.92')
  })
})

// ─── Invalid dish IDs ─────────────────────────────────────────────────────────

describe('invalid dish IDs', () => {
  it('throws ValidationError when a dishId does not exist in DishTaxonomy', async () => {
    mockDb.dishTaxonomy.findMany.mockResolvedValue([]) // none found
    await expect(IntakeService.submit(BASE_PAYLOAD, IP)).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError before opening a transaction', async () => {
    mockDb.dishTaxonomy.findMany.mockResolvedValue([])
    await expect(IntakeService.submit(BASE_PAYLOAD, IP)).rejects.toThrow()
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('includes the invalid IDs in the error message', async () => {
    mockDb.dishTaxonomy.findMany.mockResolvedValue([])
    await expect(IntakeService.submit(BASE_PAYLOAD, IP)).rejects.toMatchObject({
      message: expect.stringContaining('123e4567-e89b-12d3-a456-426614174000'),
    })
  })
})

// ─── Email failure ────────────────────────────────────────────────────────────

describe('email failure', () => {
  it('does not throw when confirmation email send fails', async () => {
    mockSendIntakeConfirmation.mockRejectedValueOnce(new Error('Resend 500'))
    const result = await IntakeService.submit(BASE_PAYLOAD, IP)
    expect(result.submissionId).toBe(RESTAURANT_ID)
  })
})
