// dishes.data.test.ts — validates slug correctness and uniqueness for all seeded dishes.
//
// These tests enforce the constraints that the DB unique constraint also enforces,
// but at the data layer so failures surface during development, not at migration time.

import { describe, it, expect } from 'vitest'
import { DISHES } from './dishes.data'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

describe('DISHES seed data — slug integrity', () => {
  it('every dish has a slug', () => {
    const missing = DISHES.filter((d) => !d.slug || d.slug.trim() === '')
    expect(missing).toHaveLength(0)
  })

  it('all slugs are unique', () => {
    const slugs = DISHES.map((d) => d.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('all slugs match the URL-safe pattern (lowercase alphanumeric + hyphens, no leading/trailing hyphens)', () => {
    const invalid = DISHES.filter((d) => !SLUG_PATTERN.test(d.slug))
    expect(invalid).toHaveLength(0)
  })

  it('no slug exceeds 200 characters', () => {
    const tooLong = DISHES.filter((d) => d.slug.length > 200)
    expect(tooLong).toHaveLength(0)
  })

  it('no slug is shorter than 2 characters', () => {
    const tooShort = DISHES.filter((d) => d.slug.length < 2)
    expect(tooShort).toHaveLength(0)
  })

  it('all canonicalNames have a slug', () => {
    const withoutSlug = DISHES.filter((d) => !d.slug)
    expect(withoutSlug.map((d) => d.canonicalName)).toEqual([])
  })

  it('slugs are consistent with canonicalName (lowercase, no special chars)', () => {
    // Each slug must be derivable from the canonical name — spot-check key dishes
    const checks: Array<[string, string]> = [
      ['Jollof Rice', 'jollof-rice'],
      ['Egusi Soup', 'egusi-soup'],
      ['Pounded Yam', 'pounded-yam'],
      ['Eba', 'eba'],
      ['Suya', 'suya'],
      ['Moi Moi', 'moi-moi'],
      ['Puff Puff', 'puff-puff'],
      ['Isi Ewu', 'isi-ewu'],
      ['Efo Riro', 'efo-riro'],
      ['Ofe Onugbu', 'ofe-onugbu'],
    ]

    for (const [name, expectedSlug] of checks) {
      const dish = DISHES.find((d) => d.canonicalName === name)
      expect(dish, `dish "${name}" not found in DISHES`).toBeDefined()
      expect(dish!.slug).toBe(expectedSlug)
    }
  })

  it('total dish count is 50', () => {
    expect(DISHES).toHaveLength(50)
  })
})
