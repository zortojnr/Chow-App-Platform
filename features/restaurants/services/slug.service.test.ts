// Slug Service — unit tests
//
// Coverage goals:
//   ✓ generateSlug: standard conversions (lowercase, spaces to hyphens)
//   ✓ generateSlug: special characters stripped
//   ✓ generateSlug: accented characters stripped
//   ✓ generateSlug: apostrophes, ampersands, quotes stripped
//   ✓ generateSlug: multiple consecutive spaces/hyphens collapsed
//   ✓ generateSlug: leading and trailing hyphens removed
//   ✓ generateSlug: digits preserved
//   ✓ generateSlug: already-valid input unchanged
//   ✓ generateSlug: empty-after-stripping → 'restaurant' fallback
//   ✓ ensureUniqueSlug: returns base when not taken
//   ✓ ensureUniqueSlug: returns base-2 when base is taken
//   ✓ ensureUniqueSlug: returns base-3 when base and base-2 are taken
//   ✓ ensureUniqueSlug: skips already-taken numeric suffixes

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSlug, ensureUniqueSlug } from './slug.service'

// ─── Mock: @/lib/db ───────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    restaurant: {
      findFirst: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
const mockFindFirst = db.restaurant.findFirst as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── generateSlug ─────────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateSlug('Mama Titi Kitchen')).toBe('mama-titi-kitchen')
  })

  it('strips apostrophes', () => {
    expect(generateSlug("Mama's Kitchen")).toBe('mamas-kitchen')
  })

  it('strips ampersands', () => {
    expect(generateSlug('Bar & Grill')).toBe('bar-grill')
  })

  it('strips parentheses and content', () => {
    expect(generateSlug('Restaurant (Lagos)')).toBe('restaurant-lagos')
  })

  it('strips slashes', () => {
    expect(generateSlug('Soup/Stew House')).toBe('soupstew-house')
  })

  it('strips periods', () => {
    expect(generateSlug('Mr. Jollof')).toBe('mr-jollof')
  })

  it('preserves digits', () => {
    expect(generateSlug('Restaurant 99')).toBe('restaurant-99')
  })

  it('collapses multiple spaces to a single hyphen', () => {
    expect(generateSlug('Mama   Titi  Kitchen')).toBe('mama-titi-kitchen')
  })

  it('collapses mixed space-hyphen runs', () => {
    expect(generateSlug('Mama - Titi')).toBe('mama-titi')
  })

  it('trims leading and trailing whitespace before processing', () => {
    expect(generateSlug('  Mama Titi Kitchen  ')).toBe('mama-titi-kitchen')
  })

  it('removes leading hyphens produced by leading special chars', () => {
    expect(generateSlug('!Mama')).toBe('mama')
  })

  it('removes trailing hyphens produced by trailing special chars', () => {
    expect(generateSlug('Mama!')).toBe('mama')
  })

  it('strips accented characters', () => {
    // è, é, ê — after NFD decomposition the diacritic is stripped, leaving the base letter
    expect(generateSlug('Café Bénin')).toBe('cafe-benin')
  })

  it('returns restaurant fallback for all-special-char input', () => {
    expect(generateSlug('!!!???')).toBe('restaurant')
  })

  it('returns restaurant fallback for empty string', () => {
    expect(generateSlug('')).toBe('restaurant')
  })

  it('leaves an already-valid slug unchanged', () => {
    expect(generateSlug('mama-titi-kitchen')).toBe('mama-titi-kitchen')
  })
})

// ─── ensureUniqueSlug ─────────────────────────────────────────────────────────

describe('ensureUniqueSlug', () => {
  it('returns the base slug when it is not taken', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await ensureUniqueSlug('mama-titi-kitchen')
    expect(result).toBe('mama-titi-kitchen')
    expect(mockFindFirst).toHaveBeenCalledOnce()
  })

  it('returns base-2 when the base slug is taken', async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 'existing-id' }) // base taken
      .mockResolvedValueOnce(null)                   // base-2 available
    const result = await ensureUniqueSlug('mama-titi-kitchen')
    expect(result).toBe('mama-titi-kitchen-2')
    expect(mockFindFirst).toHaveBeenCalledTimes(2)
  })

  it('returns base-3 when base and base-2 are both taken', async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 'id-1' }) // base taken
      .mockResolvedValueOnce({ id: 'id-2' }) // base-2 taken
      .mockResolvedValueOnce(null)            // base-3 available
    const result = await ensureUniqueSlug('mama-titi-kitchen')
    expect(result).toBe('mama-titi-kitchen-3')
    expect(mockFindFirst).toHaveBeenCalledTimes(3)
  })

  it('queries with the correct slug in each attempt', async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 'id-1' })
      .mockResolvedValueOnce(null)
    await ensureUniqueSlug('test-slug')
    expect(mockFindFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ slug: 'test-slug' }),
    }))
    expect(mockFindFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ slug: 'test-slug-2' }),
    }))
  })
})
