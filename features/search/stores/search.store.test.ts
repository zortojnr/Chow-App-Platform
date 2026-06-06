// search.store.test.ts — Step 19 §8.1
//
// Verifies the client-side idle-state history surface used by SearchBar.
// The store maintains anonRecentSearches (session-level search history visible
// to all users). This is the Phase 1 idle-state data source; full
// cross-session UserSearchHistory retrieval is Track 5.
//
// Step 19 item 4: "End-to-end test: user makes 3 searches → bar shows last 3 in idle state"
//
// Coverage:
//   ✓ addAnonRecentSearch adds entries to front of list
//   ✓ most recent search appears first (idle state order)
//   ✓ 3 searches produce 3 idle-state entries in correct order
//   ✓ duplicate queries removed before prepend (case-insensitive)
//   ✓ list capped at 5 entries (§8.1: "last 5 searches")
//   ✓ clearAnonRecentSearches empties the list
//   ✓ setCityContext updates city and can be cleared to null

import { describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore } from './search.store'

// Reset store state before each test (partial update — actions are preserved)
function resetStore() {
  useSearchStore.setState({ cityContext: null, anonRecentSearches: [] })
}

describe('SearchStore — anonRecentSearches (idle state source)', () => {
  beforeEach(resetStore)

  // ─── Step 19 item 4: 3 searches visible in idle state ────────

  it('after 3 searches, idle state contains exactly 3 entries — Step 19 §8.1', () => {
    const { addAnonRecentSearch } = useSearchStore.getState()
    addAnonRecentSearch('jollof rice', 'Lagos')
    addAnonRecentSearch('egusi soup', 'Lagos')
    addAnonRecentSearch('suya', 'Abuja')

    const { anonRecentSearches } = useSearchStore.getState()
    expect(anonRecentSearches).toHaveLength(3)
  })

  it('idle state entries appear in most-recent-first order — Step 19 §8.1', () => {
    const { addAnonRecentSearch } = useSearchStore.getState()
    addAnonRecentSearch('jollof rice', 'Lagos')
    addAnonRecentSearch('egusi soup', 'Lagos')
    addAnonRecentSearch('suya', 'Abuja')

    const { anonRecentSearches } = useSearchStore.getState()
    expect(anonRecentSearches[0].query).toBe('suya')        // last search → first
    expect(anonRecentSearches[1].query).toBe('egusi soup')
    expect(anonRecentSearches[2].query).toBe('jollof rice') // first search → last
  })

  it('location is stored with each idle-state entry', () => {
    useSearchStore.getState().addAnonRecentSearch('pepper soup', 'Port Harcourt')
    const entry = useSearchStore.getState().anonRecentSearches[0]
    expect(entry.query).toBe('pepper soup')
    expect(entry.location).toBe('Port Harcourt')
  })

  it('location is null when no city context at time of search', () => {
    useSearchStore.getState().addAnonRecentSearch('akara', null)
    const entry = useSearchStore.getState().anonRecentSearches[0]
    expect(entry.location).toBeNull()
  })

  // ─── Deduplication ────────────────────────────────────────────

  it('re-searching the same query moves it to the front, no duplicate', () => {
    const { addAnonRecentSearch } = useSearchStore.getState()
    addAnonRecentSearch('suya', 'Lagos')
    addAnonRecentSearch('jollof rice', 'Lagos')
    addAnonRecentSearch('suya', 'Abuja')  // re-search suya

    const { anonRecentSearches } = useSearchStore.getState()
    expect(anonRecentSearches).toHaveLength(2)             // not 3
    expect(anonRecentSearches[0].query).toBe('suya')       // moved to front
    expect(anonRecentSearches[0].location).toBe('Abuja')   // updated location
    expect(anonRecentSearches[1].query).toBe('jollof rice')
  })

  it('deduplication is case-insensitive', () => {
    const { addAnonRecentSearch } = useSearchStore.getState()
    addAnonRecentSearch('Suya', 'Lagos')
    addAnonRecentSearch('SUYA', null)

    const { anonRecentSearches } = useSearchStore.getState()
    expect(anonRecentSearches).toHaveLength(1)
    expect(anonRecentSearches[0].query).toBe('SUYA')
  })

  // ─── Max entries cap ─────────────────────────────────────────

  it('caps idle state at 5 entries (§8.1 "last 5 searches")', () => {
    const { addAnonRecentSearch } = useSearchStore.getState()
    for (let i = 1; i <= 7; i++) {
      addAnonRecentSearch(`dish ${i}`, null)
    }
    expect(useSearchStore.getState().anonRecentSearches).toHaveLength(5)
  })

  it('oldest entries are dropped when cap is reached', () => {
    const { addAnonRecentSearch } = useSearchStore.getState()
    for (let i = 1; i <= 6; i++) {
      addAnonRecentSearch(`dish ${i}`, null)
    }
    const queries = useSearchStore.getState().anonRecentSearches.map((r) => r.query)
    // dishes 1 is the oldest and should have been dropped
    expect(queries).not.toContain('dish 1')
    expect(queries).toContain('dish 6')
  })

  // ─── Clear ────────────────────────────────────────────────────

  it('clearAnonRecentSearches empties the idle state list', () => {
    const { addAnonRecentSearch, clearAnonRecentSearches } = useSearchStore.getState()
    addAnonRecentSearch('suya', null)
    addAnonRecentSearch('jollof rice', null)
    clearAnonRecentSearches()
    expect(useSearchStore.getState().anonRecentSearches).toHaveLength(0)
  })
})

// ─── City context ─────────────────────────────────────────────

describe('SearchStore — cityContext', () => {
  beforeEach(resetStore)

  it('defaults to null (no city selected)', () => {
    expect(useSearchStore.getState().cityContext).toBeNull()
  })

  it('setCityContext updates city', () => {
    useSearchStore.getState().setCityContext('Lagos')
    expect(useSearchStore.getState().cityContext).toBe('Lagos')
  })

  it('setCityContext(null) clears city', () => {
    useSearchStore.getState().setCityContext('Abuja')
    useSearchStore.getState().setCityContext(null)
    expect(useSearchStore.getState().cityContext).toBeNull()
  })

  it('city can be changed from one value to another', () => {
    useSearchStore.getState().setCityContext('Lagos')
    useSearchStore.getState().setCityContext('Kano')
    expect(useSearchStore.getState().cityContext).toBe('Kano')
  })
})
