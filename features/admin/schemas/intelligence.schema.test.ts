import { describe, it, expect } from 'vitest'
import { DishAvailabilityStatus, PriceRange } from '@prisma/client'
import {
  VerifyDishSchema,
  VerifyPhotoSchema,
  IntelligenceUpdateSchema,
} from './intelligence.schema'

// ─────────────────────────────────────────────────────────────
// VerifyDishSchema
// ─────────────────────────────────────────────────────────────

describe('VerifyDishSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(VerifyDishSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a full valid payload', () => {
    const r = VerifyDishSchema.safeParse({
      verifiedAt:         '2026-06-04T10:00:00.000Z',
      nameAsServed:       'Mama Titi Jollof',
      availabilityStatus: DishAvailabilityStatus.ALWAYS_AVAILABLE,
      price:              2500,
    })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid datetime string', () => {
    expect(VerifyDishSchema.safeParse({ verifiedAt: 'not-a-date' }).success).toBe(false)
  })

  it('rejects nameAsServed as an empty string', () => {
    expect(VerifyDishSchema.safeParse({ nameAsServed: '' }).success).toBe(false)
  })

  it('rejects nameAsServed exceeding 150 characters', () => {
    expect(VerifyDishSchema.safeParse({ nameAsServed: 'a'.repeat(151) }).success).toBe(false)
  })

  it('rejects an invalid DishAvailabilityStatus', () => {
    expect(VerifyDishSchema.safeParse({ availabilityStatus: 'ALWAYS' }).success).toBe(false)
  })

  it('rejects a non-positive price', () => {
    expect(VerifyDishSchema.safeParse({ price: 0 }).success).toBe(false)
    expect(VerifyDishSchema.safeParse({ price: -100 }).success).toBe(false)
  })

  it('accepts a positive price', () => {
    expect(VerifyDishSchema.safeParse({ price: 0.01 }).success).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// VerifyPhotoSchema
// ─────────────────────────────────────────────────────────────

describe('VerifyPhotoSchema', () => {
  it('accepts { isVerified: true }', () => {
    expect(VerifyPhotoSchema.safeParse({ isVerified: true }).success).toBe(true)
  })

  it('accepts { isVerified: false }', () => {
    expect(VerifyPhotoSchema.safeParse({ isVerified: false }).success).toBe(true)
  })

  it('accepts isVerified with isPrimary', () => {
    const r = VerifyPhotoSchema.safeParse({ isVerified: true, isPrimary: true })
    expect(r.success).toBe(true)
  })

  it('rejects when isVerified is absent', () => {
    expect(VerifyPhotoSchema.safeParse({}).success).toBe(false)
  })

  it('rejects a non-boolean isVerified', () => {
    expect(VerifyPhotoSchema.safeParse({ isVerified: 'yes' }).success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// IntelligenceUpdateSchema
// ─────────────────────────────────────────────────────────────

describe('IntelligenceUpdateSchema', () => {
  it('rejects an empty object (at least one field required)', () => {
    expect(IntelligenceUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a partial update with only description', () => {
    expect(
      IntelligenceUpdateSchema.safeParse({ description: 'Updated description text' }).success,
    ).toBe(true)
  })

  it('accepts a partial update with only phone', () => {
    expect(IntelligenceUpdateSchema.safeParse({ phone: '08012345678' }).success).toBe(true)
  })

  it('accepts null to clear email', () => {
    const r = IntelligenceUpdateSchema.safeParse({ email: null })
    expect(r.success).toBe(true)
    expect(r.data?.email).toBeNull()
  })

  it('accepts null to clear website', () => {
    expect(IntelligenceUpdateSchema.safeParse({ website: null }).success).toBe(true)
  })

  it('rejects an invalid email format', () => {
    expect(IntelligenceUpdateSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects an invalid website URL', () => {
    expect(IntelligenceUpdateSchema.safeParse({ website: 'not-a-url' }).success).toBe(false)
  })

  it('accepts a valid URL', () => {
    expect(
      IntelligenceUpdateSchema.safeParse({ website: 'https://restaurant.com' }).success,
    ).toBe(true)
  })

  it('accepts all valid PriceRange values', () => {
    for (const pr of Object.values(PriceRange)) {
      expect(IntelligenceUpdateSchema.safeParse({ priceRange: pr }).success).toBe(true)
    }
  })

  it('rejects an invalid PriceRange value', () => {
    expect(IntelligenceUpdateSchema.safeParse({ priceRange: 'CHEAP' }).success).toBe(false)
  })

  it('rejects description exceeding 500 characters', () => {
    expect(IntelligenceUpdateSchema.safeParse({ description: 'a'.repeat(501) }).success).toBe(false)
  })

  it('trims whitespace from description', () => {
    const r = IntelligenceUpdateSchema.safeParse({ description: '  Good food  ' })
    expect(r.data?.description).toBe('Good food')
  })
})
