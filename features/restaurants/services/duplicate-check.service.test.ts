// Duplicate Check Service — unit tests
//
// Coverage goals (restaurant-intake-track.md §5):
//   ✓ CLEAR: no exact match, no fuzzy match
//   ✓ EXACT_DUPLICATE: case-insensitive name match in same city
//   ✓ POSSIBLE_DUPLICATE: fuzzy match above 0.75 threshold
//   ✓ CLEAR when fuzzy returns empty array
//   ✓ findFirst receives the correct city filter
//   ✓ $queryRaw is not called when exact match found (short-circuits)
//   ✓ Returned similarity values are converted to numbers

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkForDuplicate } from './duplicate-check.service'

// ─── Mock: @/lib/db ───────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

import { db } from '@/lib/db'
const mockFindFirst = db.restaurant.findFirst as ReturnType<typeof vi.fn>
const mockQueryRaw = db.$queryRaw as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── CLEAR ────────────────────────────────────────────────────────────────────

describe('CLEAR result', () => {
  it('returns CLEAR when no exact or fuzzy match exists', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([])
    const result = await checkForDuplicate('Mama Titi Kitchen', 'Lagos')
    expect(result).toEqual({ status: 'CLEAR' })
  })

  it('calls both findFirst and $queryRaw when exact is null', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([])
    await checkForDuplicate('Mama Titi Kitchen', 'Lagos')
    expect(mockFindFirst).toHaveBeenCalledOnce()
    expect(mockQueryRaw).toHaveBeenCalledOnce()
  })
})

// ─── EXACT_DUPLICATE ─────────────────────────────────────────────────────────

describe('EXACT_DUPLICATE result', () => {
  it('returns EXACT_DUPLICATE when findFirst returns a restaurant', async () => {
    mockFindFirst.mockResolvedValue({ id: 'rest-id-123', slug: 'mama-titi-kitchen' })
    const result = await checkForDuplicate('Mama Titi Kitchen', 'Lagos')
    expect(result).toEqual({
      status: 'EXACT_DUPLICATE',
      existingId: 'rest-id-123',
      existingSlug: 'mama-titi-kitchen',
    })
  })

  it('does not call $queryRaw when exact match is found', async () => {
    mockFindFirst.mockResolvedValue({ id: 'rest-id-123', slug: 'mama-titi-kitchen' })
    await checkForDuplicate('Mama Titi Kitchen', 'Lagos')
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('passes the correct city to findFirst', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([])
    await checkForDuplicate('Some Restaurant', 'Abuja')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ city: 'Abuja' }),
      }),
    )
  })

  it('uses case-insensitive mode in findFirst', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([])
    await checkForDuplicate('Mama Titi', 'Lagos')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: expect.objectContaining({ mode: 'insensitive' }),
        }),
      }),
    )
  })
})

// ─── POSSIBLE_DUPLICATE ──────────────────────────────────────────────────────

describe('POSSIBLE_DUPLICATE result', () => {
  it('returns POSSIBLE_DUPLICATE when $queryRaw returns candidates', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([
      { id: 'rest-id-1', name: 'Mama Titi Kitchenn', similarity: 0.92 },
      { id: 'rest-id-2', name: 'Mama Titi Kitchen Ltd', similarity: 0.85 },
    ])
    const result = await checkForDuplicate('Mama Titi Kitchen', 'Lagos')
    expect(result.status).toBe('POSSIBLE_DUPLICATE')
    if (result.status === 'POSSIBLE_DUPLICATE') {
      expect(result.candidates).toHaveLength(2)
      expect(result.candidates[0]).toEqual({
        id: 'rest-id-1',
        name: 'Mama Titi Kitchenn',
        similarity: 0.92,
      })
    }
  })

  it('converts similarity values to numbers', async () => {
    mockFindFirst.mockResolvedValue(null)
    // PostgreSQL can return Decimal-like objects — simulate with string
    mockQueryRaw.mockResolvedValue([
      { id: 'id-1', name: 'Test', similarity: '0.88' },
    ])
    const result = await checkForDuplicate('Test', 'Lagos')
    if (result.status === 'POSSIBLE_DUPLICATE') {
      expect(typeof result.candidates[0].similarity).toBe('number')
      expect(result.candidates[0].similarity).toBeCloseTo(0.88)
    }
  })

  it('returns CLEAR when $queryRaw returns empty array', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([])
    const result = await checkForDuplicate('Mama Titi Kitchen', 'Lagos')
    expect(result.status).toBe('CLEAR')
  })
})
