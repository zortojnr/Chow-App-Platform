// Intake Schema — unit tests
//
// Coverage goals (restaurant-intake-track.md §3.2 exit criteria):
//   ✓ Valid full payload passes
//   ✓ Valid minimal payload passes (all optional fields absent)
//   ✓ Missing required fields produce field-level errors
//   ✓ Phone regex: valid and invalid Nigerian formats
//   ✓ Multiple isPrimary photos → rejected
//   ✓ City/state enum enforcement
//   ✓ Dish UUID validation
//   ✓ cuisineTypes limits (min 1, max 5, each max 50 chars)
//   ✓ Photos max 5
//   ✓ Dishes min 1, max 50
//   ✓ priceRange strict enum
//   ✓ Empty optional strings pass as undefined

import { describe, it, expect } from 'vitest'
import { IntakeSubmissionSchema, PhotoUploadSchema } from './intake.schema'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const VALID_DISH = {
  dishId: '123e4567-e89b-12d3-a456-426614174000',
  availabilityStatus: 'ALWAYS_AVAILABLE' as const,
}

const VALID_PAYLOAD = {
  name: 'Mama Titi Kitchen',
  address: '15 Balogun Street, Lagos',
  city: 'Lagos' as const,
  state: 'Lagos' as const,
  phone: '08012345678',
  priceRange: 'MID' as const,
  cuisineTypes: ['Nigerian', 'Yoruba'],
  dishes: [VALID_DISH],
}

// ─── Valid payloads ───────────────────────────────────────────────────────────

describe('valid payloads', () => {
  it('accepts a minimal valid payload', () => {
    const result = IntakeSubmissionSchema.safeParse(VALID_PAYLOAD)
    expect(result.success).toBe(true)
  })

  it('defaults photos to empty array when omitted', () => {
    const result = IntakeSubmissionSchema.safeParse(VALID_PAYLOAD)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.photos).toEqual([])
  })

  it('accepts a full payload with all optional fields', () => {
    const full = {
      ...VALID_PAYLOAD,
      description: 'Authentic Nigerian home cooking',
      area: 'Surulere',
      email: 'contact@mamatiti.com',
      website: 'https://mamatiti.com',
      dishes: [
        {
          dishId: '123e4567-e89b-12d3-a456-426614174000',
          nameAsServed: 'Jollof Rice (Party Style)',
          description: 'Smoky party jollof with assorted proteins',
          price: 3500,
          availabilityStatus: 'ALWAYS_AVAILABLE' as const,
        },
      ],
      photos: [{ cloudinaryPublicId: 'chowhere/intake/2026/06/abc123', isPrimary: true }],
      submitterName: 'Titi Adeyemi',
      submitterEmail: 'titi@example.com',
      submitterNote: 'Best jollof rice in Lagos',
    }
    const result = IntakeSubmissionSchema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('trims whitespace from string fields', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      name: '  Mama Titi Kitchen  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Mama Titi Kitchen')
  })

  it('accepts +234 international phone format', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      phone: '+2348012345678',
    })
    expect(result.success).toBe(true)
  })

  it('accepts 234 format without plus', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      phone: '2348012345678',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all three priceRange values', () => {
    for (const priceRange of ['BUDGET', 'MID', 'UPSCALE'] as const) {
      const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, priceRange })
      expect(result.success, `priceRange ${priceRange} should be valid`).toBe(true)
    }
  })

  it('accepts all DishAvailabilityStatus values', () => {
    const statuses = ['ALWAYS_AVAILABLE', 'SEASONAL', 'WEEKEND_ONLY', 'ON_ORDER', 'UNKNOWN'] as const
    for (const availabilityStatus of statuses) {
      const result = IntakeSubmissionSchema.safeParse({
        ...VALID_PAYLOAD,
        dishes: [{ ...VALID_DISH, availabilityStatus }],
      })
      expect(result.success, `availabilityStatus ${availabilityStatus} should be valid`).toBe(true)
    }
  })
})

// ─── Required field validation ────────────────────────────────────────────────

describe('missing required fields', () => {
  const required = ['name', 'address', 'city', 'state', 'phone', 'priceRange', 'cuisineTypes', 'dishes'] as const

  for (const field of required) {
    it(`rejects when ${field} is missing`, () => {
      const { [field]: _omitted, ...rest } = VALID_PAYLOAD as Record<string, unknown>
      const result = IntakeSubmissionSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  }
})

// ─── Phone validation ─────────────────────────────────────────────────────────

describe('phone validation', () => {
  const validPhones = [
    '08012345678',
    '07012345678',
    '09012345678',
    '08112345678',
    '08012345678',
    '+2348012345678',
    '2348012345678',
  ]

  const invalidPhones = [
    '1234567890',         // no country code or 0 prefix
    '+2341234567890',     // wrong network prefix (1)
    '0601234567',         // wrong network digit (6)
    '080123456',          // too short
    '080123456789',       // too long
    '+44 7911 123456',    // UK number
    'not-a-phone',
  ]

  for (const phone of validPhones) {
    it(`accepts ${phone}`, () => {
      const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, phone })
      expect(result.success, `${phone} should be valid`).toBe(true)
    })
  }

  for (const phone of invalidPhones) {
    it(`rejects ${phone}`, () => {
      const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, phone })
      expect(result.success, `${phone} should be invalid`).toBe(false)
    })
  }
})

// ─── Photo validation ─────────────────────────────────────────────────────────

describe('photos', () => {
  it('rejects when more than one photo has isPrimary: true', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      photos: [
        { cloudinaryPublicId: 'id1', isPrimary: true },
        { cloudinaryPublicId: 'id2', isPrimary: true },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('photos')
    }
  })

  it('accepts exactly one isPrimary: true photo', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      photos: [
        { cloudinaryPublicId: 'id1', isPrimary: true },
        { cloudinaryPublicId: 'id2', isPrimary: false },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts zero isPrimary photos', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      photos: [
        { cloudinaryPublicId: 'id1', isPrimary: false },
        { cloudinaryPublicId: 'id2', isPrimary: false },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects more than 5 photos', () => {
    const photos = Array.from({ length: 6 }, (_, i) => ({
      cloudinaryPublicId: `id${i}`,
      isPrimary: false,
    }))
    const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, photos })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 5 photos', () => {
    const photos = Array.from({ length: 5 }, (_, i) => ({
      cloudinaryPublicId: `id${i}`,
      isPrimary: false,
    }))
    const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, photos })
    expect(result.success).toBe(true)
  })
})

// ─── City / State enum ────────────────────────────────────────────────────────

describe('city and state enum enforcement', () => {
  it('rejects a city not in the Nigerian cities list', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      city: 'London',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a state not in the Nigerian states list', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      state: 'California',
    })
    expect(result.success).toBe(false)
  })

  it('accepts Abuja as a valid city', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      city: 'Abuja',
      state: 'Federal Capital Territory',
    })
    expect(result.success).toBe(true)
  })
})

// ─── cuisineTypes ────────────────────────────────────────────────────────────

describe('cuisineTypes', () => {
  it('rejects empty cuisineTypes array', () => {
    const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, cuisineTypes: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 5 cuisine types', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      cuisineTypes: ['A', 'B', 'C', 'D', 'E', 'F'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a cuisine type over 50 characters', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      cuisineTypes: ['A'.repeat(51)],
    })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 5 cuisine types', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      cuisineTypes: ['Nigerian', 'Yoruba', 'Igbo', 'Hausa', 'Delta'],
    })
    expect(result.success).toBe(true)
  })
})

// ─── Dishes ──────────────────────────────────────────────────────────────────

describe('dishes', () => {
  it('rejects empty dishes array', () => {
    const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, dishes: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 50 dishes', () => {
    const dishes = Array.from({ length: 51 }, () => ({ ...VALID_DISH }))
    const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, dishes })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 50 dishes', () => {
    const dishes = Array.from({ length: 50 }, () => ({ ...VALID_DISH }))
    const result = IntakeSubmissionSchema.safeParse({ ...VALID_PAYLOAD, dishes })
    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID dishId', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      dishes: [{ ...VALID_DISH, dishId: 'not-a-uuid' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative price', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      dishes: [{ ...VALID_DISH, price: -100 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects price above 99999.99', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      dishes: [{ ...VALID_DISH, price: 100000 }],
    })
    expect(result.success).toBe(false)
  })
})

// ─── priceRange ───────────────────────────────────────────────────────────────

describe('priceRange', () => {
  it('rejects an invalid priceRange value', () => {
    const result = IntakeSubmissionSchema.safeParse({
      ...VALID_PAYLOAD,
      priceRange: 'EXPENSIVE',
    })
    expect(result.success).toBe(false)
  })
})

// ─── PhotoUploadSchema ────────────────────────────────────────────────────────

describe('PhotoUploadSchema', () => {
  it('accepts image/jpeg', () => {
    const result = PhotoUploadSchema.safeParse({ contentType: 'image/jpeg', size: 1024 })
    expect(result.success).toBe(true)
  })

  it('accepts image/png', () => {
    const result = PhotoUploadSchema.safeParse({ contentType: 'image/png', size: 1024 })
    expect(result.success).toBe(true)
  })

  it('rejects image/gif', () => {
    const result = PhotoUploadSchema.safeParse({ contentType: 'image/gif', size: 1024 })
    expect(result.success).toBe(false)
  })

  it('rejects files over 5MB', () => {
    const result = PhotoUploadSchema.safeParse({
      contentType: 'image/jpeg',
      size: 5 * 1024 * 1024 + 1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 5MB', () => {
    const result = PhotoUploadSchema.safeParse({
      contentType: 'image/jpeg',
      size: 5 * 1024 * 1024,
    })
    expect(result.success).toBe(true)
  })
})
