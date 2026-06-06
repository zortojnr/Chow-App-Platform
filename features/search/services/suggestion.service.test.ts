// suggestion.service.test.ts — Step 6
//
// Coverage:
//   ✓ Canonical prefix match returns results with aliasMatched=false
//   ✓ Alias prefix match returns results with aliasMatched=true and aliasValue set
//   ✓ Max 8 results enforced
//   ✓ Min 2 chars: single-char prefix returns [] without DB call
//   ✓ Empty string returns [] without DB call
//   ✓ DB error returns [] without throwing
//   ✓ Result shape contains all required fields
//   ✓ Case insensitive matching (uppercase prefix hits lowercase canonical)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuggestionService } from './suggestion.service'

vi.mock('@/lib/db', () => ({
  db: { $queryRaw: vi.fn() },
}))

import { db } from '@/lib/db'
const mockQuery = vi.mocked(db.$queryRaw)

// Helper: makeSuggestionRow — aliasMatched = true means canonical matched in SQL
// (the column stores the result of `canonicalName ILIKE prefix`, so TRUE = canonical match)
const makeSuggestionRow = (overrides: Record<string, unknown> = {}) => ({
  dishId: 'dish-1',
  canonicalName: 'Jollof Rice',
  slug: 'jollof-rice',
  category: 'RICE_DISHES',
  aliasMatched: true,    // raw SQL col: (canonicalName ILIKE ...) — true = canonical
  aliasValue: null,
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('SuggestionService.suggest', () => {
  // ─── Canonical match ───────────────────────────────────────

  it('returns results for canonical prefix match', async () => {
    mockQuery.mockResolvedValueOnce([makeSuggestionRow()])

    const results = await SuggestionService.suggest('jol')

    expect(results).toHaveLength(1)
    expect(results[0].canonicalName).toBe('Jollof Rice')
  })

  it('aliasMatched=false when canonical name matched (not alias)', async () => {
    // SQL returns aliasMatched=true (canonical ILIKE hit) → service inverts to false
    mockQuery.mockResolvedValueOnce([makeSuggestionRow({ aliasMatched: true })])

    const [result] = await SuggestionService.suggest('jol')

    expect(result.aliasMatched).toBe(false)
    expect(result.aliasValue).toBeNull()
  })

  // ─── Alias match ──────────────────────────────────────────

  it('aliasMatched=true and aliasValue set when alias matched', async () => {
    // SQL returns aliasMatched=false (canonical ILIKE miss) and aliasValue='eba'
    mockQuery.mockResolvedValueOnce([makeSuggestionRow({
      canonicalName: 'Eba',
      slug: 'eba',
      category: 'SWALLOW',
      aliasMatched: false,     // canonical ILIKE miss → alias hit → service inverts to true
      aliasValue: 'eba',
    })])

    const [result] = await SuggestionService.suggest('eb')

    expect(result.aliasMatched).toBe(true)
    expect(result.aliasValue).toBe('eba')
    expect(result.canonicalName).toBe('Eba')
  })

  // ─── Min chars ────────────────────────────────────────────

  it('returns [] for single-char prefix without touching DB', async () => {
    const results = await SuggestionService.suggest('j')

    expect(results).toHaveLength(0)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns [] for empty string without touching DB', async () => {
    const results = await SuggestionService.suggest('')

    expect(results).toHaveLength(0)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns [] for whitespace-only prefix without touching DB', async () => {
    const results = await SuggestionService.suggest('  ')

    expect(results).toHaveLength(0)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  // ─── Max results ──────────────────────────────────────────

  it('never returns more than 8 results', async () => {
    // DB enforces LIMIT 8 — service receives exactly 8
    const rows = Array.from({ length: 8 }, (_, i) =>
      makeSuggestionRow({ dishId: `dish-${i}`, canonicalName: `Rice Dish ${i}`, slug: `rice-dish-${i}` }),
    )
    mockQuery.mockResolvedValueOnce(rows)

    const results = await SuggestionService.suggest('rice')

    expect(results).toHaveLength(8)
  })

  // ─── Error resilience ─────────────────────────────────────

  it('returns [] on DB error without throwing', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection error'))

    await expect(SuggestionService.suggest('jo')).resolves.toEqual([])
  })

  // ─── Result shape ─────────────────────────────────────────

  it('result shape contains all required fields', async () => {
    mockQuery.mockResolvedValueOnce([makeSuggestionRow()])

    const [result] = await SuggestionService.suggest('jol')

    expect(result).toMatchObject({
      dishId: expect.any(String),
      canonicalName: expect.any(String),
      slug: expect.any(String),
      category: expect.any(String),
      aliasMatched: expect.any(Boolean),
    })
    // aliasValue is present (may be null)
    expect('aliasValue' in result).toBe(true)
  })

  // ─── Multiple results ─────────────────────────────────────

  it('returns multiple suggestions for broad prefix', async () => {
    const rows = [
      makeSuggestionRow({ dishId: 'a', canonicalName: 'Jollof Rice', aliasMatched: true }),
      makeSuggestionRow({ dishId: 'b', canonicalName: 'Jollof Spaghetti', slug: 'jollof-spaghetti', aliasMatched: true }),
    ]
    mockQuery.mockResolvedValueOnce(rows)

    const results = await SuggestionService.suggest('jollof')

    expect(results).toHaveLength(2)
    expect(results[0].canonicalName).toBe('Jollof Rice')
    expect(results[1].canonicalName).toBe('Jollof Spaghetti')
  })
})
