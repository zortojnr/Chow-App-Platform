'use client'

// SearchBar — Step 13, §10.1, §10.2, §10.3
//
// The most important interactive element in the product.
//
// Desktop:
//   - Input field (52px) + floating suggestion dropdown below
//   - Search icon left, clear button or city chip right
//
// Mobile (<lg):
//   - Compact trigger that, when tapped, opens a full-screen overlay
//   - Overlay: backdrop + full-screen panel with input + inline suggestion list
//   - Back button (ArrowLeft) collapses overlay, focus returns to trigger
//
// Idle state (focused, no text):
//   - Anonymous: show top 5 popular searches from store
//   - Typed ≥ 2 chars: show autocomplete suggestions (DishTaxonomy prefix match)
//
// ARIA (DS §8.4, §15.5.4):
//   - Input: role="combobox", aria-autocomplete="list", aria-expanded, aria-controls
//   - List: role="listbox", id="search-suggestions"
//   - Items: role="option", aria-selected on highlighted item
//
// Keyboard:
//   - ArrowDown/Up: navigate suggestions
//   - Enter: select highlighted, or submit current input
//   - Escape: close dropdown / collapse overlay

import { useRef, useState, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowLeft, ChevronDown, Clock, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearchSuggestions } from '../hooks/useSearchSuggestions'
import { useSearchStore } from '../stores/search.store'
import { Badge } from '@/components/ui/badge'
import { useLocationStore } from 'features/location/stores/location.store'
import { useUserLocation } from 'features/location/hooks/useUserLocation'

// v1: Abuja only. Expand when multi-city launches.
const NIGERIAN_CITIES = ['Abuja']

// ─── Category display names ───────────────────────────────────

const CATEGORY_DISPLAY: Record<string, string> = {
  RICE_DISHES: 'Rice', SOUPS: 'Soups', SWALLOW: 'Swallow',
  STREET_FOOD: 'Street Food', PROTEIN: 'Protein', BREAKFAST: 'Breakfast',
  DRINKS: 'Drinks', SNACKS: 'Snacks', DESSERTS: 'Desserts',
}

// ─── Props ────────────────────────────────────────────────────

interface SearchBarProps {
  defaultValue?: string
  placeholder?:  string
  className?:    string
  heroMode?:     boolean    // hero on home page — full-width, prominent
  onSearch?:     (query: string) => void
}

// ─── Component ───────────────────────────────────────────────

export function SearchBar({
  defaultValue = '',
  placeholder  = 'Search for a dish...',
  className,
  heroMode     = false,
  onSearch,
}: SearchBarProps) {
  const router       = useRouter()
  const listId       = useId()
  const inputRef     = useRef<HTMLInputElement>(null)
  const overlayRef   = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [inputValue,       setInputValue]       = useState(defaultValue)
  const [isOpen,           setIsOpen]           = useState(false)
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [cityMenuOpen,     setCityMenuOpen]     = useState(false)

  const { cityContext, setCityContext, anonRecentSearches, addAnonRecentSearch } = useSearchStore()
  const { data: suggestions = [] } = useSearchSuggestions(inputValue)

  const { permission } = useLocationStore()
  const { requestLocation } = useUserLocation()

  // Show idle recent searches when empty, suggestions when typing
  const showSuggestions = isOpen && inputValue.trim().length >= 2 && suggestions.length > 0
  const showRecentSearches = isOpen && inputValue.trim().length < 2 && anonRecentSearches.length > 0
  const dropdownVisible = showSuggestions || showRecentSearches

  // Reset highlight when suggestions change
  useEffect(() => { setHighlightedIndex(-1) }, [suggestions])

  // Close on outside click (desktop only — mobile uses back button)
  useEffect(() => {
    if (isMobileExpanded) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setCityMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isMobileExpanded])

  // Focus input when mobile overlay opens
  useEffect(() => {
    if (isMobileExpanded) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isMobileExpanded])

  // ── Navigation ────────────────────────────────────────────

  const submit = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    addAnonRecentSearch(trimmed, cityContext)
    const params = new URLSearchParams({ q: trimmed })
    if (cityContext) params.set('city', cityContext)
    setIsOpen(false)
    setIsMobileExpanded(false)
    if (onSearch) {
      onSearch(trimmed)
    } else {
      router.push(`/search?${params}`)
    }
  }, [cityContext, addAnonRecentSearch, onSearch, router])

  const selectSuggestion = useCallback((canonicalName: string, slug: string) => {
    setInputValue(canonicalName)
    addAnonRecentSearch(canonicalName, cityContext)
    const params = new URLSearchParams({ q: canonicalName })
    if (cityContext) params.set('city', cityContext)
    setIsOpen(false)
    setIsMobileExpanded(false)
    router.push(`/dishes/${slug}${cityContext ? `?city=${encodeURIComponent(cityContext)}` : ''}`)
  }, [cityContext, addAnonRecentSearch, router])

  // ── Keyboard handler ──────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = showSuggestions ? suggestions : []

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        selectSuggestion(items[highlightedIndex].canonicalName, items[highlightedIndex].slug)
      } else {
        submit(inputValue)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setIsMobileExpanded(false)
      inputRef.current?.blur()
    }
  }

  // ── Input field (shared between desktop and mobile overlay) ──

  const inputField = (
    <input
      ref={inputRef}
      type="search"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={dropdownVisible}
      aria-controls={dropdownVisible ? listId : undefined}
      aria-activedescendant={highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      value={inputValue}
      onChange={(e) => { setInputValue(e.target.value); setIsOpen(true) }}
      onFocus={() => setIsOpen(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        'w-full h-full bg-transparent appearance-none outline-none',
        'text-base text-neutral-900 placeholder:text-neutral-400',
      )}
    />
  )

  // ── Suggestion list (shared) ──────────────────────────────

  const suggestionList = dropdownVisible && (
    <ul
      id={listId}
      role="listbox"
      aria-label="Search suggestions"
      className="py-1"
    >
      {showRecentSearches && anonRecentSearches.map((item, i) => (
        <li
          key={i}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === highlightedIndex}
          className={cn(
            'flex items-center gap-3 px-4 py-3 cursor-pointer',
            'transition-colors duration-fast',
            i === highlightedIndex ? 'bg-amber-50' : 'hover:bg-neutral-50',
          )}
          onMouseDown={() => submit(item.query)}
        >
          <Clock size={14} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
          <span className="text-sm text-neutral-700">{item.query}</span>
          {item.location && (
            <span className="text-xs text-neutral-400 ml-auto">{item.location}</span>
          )}
        </li>
      ))}

      {showSuggestions && suggestions.map((s, i) => (
        <li
          key={s.dishId}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === highlightedIndex}
          className={cn(
            'flex items-center justify-between px-4 py-3 cursor-pointer',
            'transition-colors duration-fast',
            i === highlightedIndex ? 'bg-amber-50' : 'hover:bg-neutral-50',
          )}
          onMouseDown={() => selectSuggestion(s.canonicalName, s.slug)}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900 truncate">{s.canonicalName}</p>
            {s.aliasMatched && s.aliasValue && (
              <p className="text-xs text-neutral-400">Also known as: {s.aliasValue}</p>
            )}
          </div>
          <Badge variant="category" className="ml-3 shrink-0">
            {CATEGORY_DISPLAY[s.category] ?? s.category}
          </Badge>
        </li>
      ))}
    </ul>
  )

  // ── City selector chip ────────────────────────────────────

  const cityChip = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setCityMenuOpen(!cityMenuOpen)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1',
          'text-xs font-medium text-neutral-600 bg-neutral-100',
          'hover:bg-neutral-200 transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:shadow-brand',
          'whitespace-nowrap shrink-0',
          // Min touch target
          'h-8',
        )}
        aria-label={cityContext ? `Current city: ${cityContext}. Tap to change.` : 'City: Abuja'}
        aria-expanded={cityMenuOpen}
      >
        {cityContext ?? 'Abuja'}
        <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
      </button>

      {cityMenuOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-1 z-50',
            'w-40 rounded-lg bg-neutral-0 shadow-md border border-neutral-200',
            'py-1 overflow-hidden',
            'animate-in fade-in-0 slide-in-from-top-1 duration-slow',
          )}
          role="menu"
        >
          {NIGERIAN_CITIES.map((c) => (
            <button
              key={c}
              role="menuitem"
              className={cn(
                'w-full text-left px-3 py-2 text-sm',
                'transition-colors duration-fast',
                cityContext === c ? 'text-amber-600 font-medium' : 'text-neutral-700 hover:bg-neutral-50',
              )}
              onMouseDown={() => { setCityContext(c); setCityMenuOpen(false) }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ── Desktop render ────────────────────────────────────────

  return (
    <>
      {/* Desktop search bar (visible at all widths in heroMode; hidden on mobile in navMode) */}
      <div
        ref={containerRef}
        className={cn(
          'relative',
          heroMode ? 'hidden lg:block w-full' : 'hidden lg:block w-full max-w-xl',
          className,
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 px-4',
            'bg-neutral-0 border rounded-[10px]',
            isOpen ? 'border-amber-500' : 'border-neutral-200 hover:border-neutral-300',
            'transition-all duration-fast',
            heroMode ? 'h-[52px]' : 'h-[44px]',
          )}
        >
          <Search size={18} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
          {inputField}

          {inputValue ? (
            <button
              type="button"
              onClick={() => { setInputValue(''); setIsOpen(false); inputRef.current?.focus() }}
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            cityChip
          )}
        </div>

        {/* Desktop dropdown */}
        {dropdownVisible && (
          <div
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-neutral-0 rounded-lg shadow-md border border-neutral-200 overflow-hidden max-h-80 overflow-y-auto"
            role="presentation"
          >
            {suggestionList}
          </div>
        )}

        {/* Invisible submit trigger */}
        <button
          type="button"
          onClick={() => submit(inputValue)}
          className="sr-only"
          tabIndex={-1}
        >
          Search
        </button>
      </div>

      {/* ── Mobile: search trigger (icon button in nav, full bar in hero) ── */}
      {!heroMode && (
        <button
          type="button"
          className={cn(
            'lg:hidden flex items-center justify-center w-10 h-10 rounded-lg',
            'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:shadow-brand',
          )}
          onClick={() => setIsMobileExpanded(true)}
          aria-label="Open search"
        >
          <Search size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {/* Hero mobile: tap the bar itself to expand */}
      {heroMode && (
        <button
          type="button"
          className={cn(
            'lg:hidden w-full flex items-center gap-3 px-4 h-12 rounded-[10px]',
            'bg-neutral-0 border border-neutral-200 text-left',
            'focus-visible:outline-none focus-visible:shadow-brand',
          )}
          onClick={() => setIsMobileExpanded(true)}
          aria-label="Open search"
        >
          <Search size={18} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
          <span className="text-sm text-neutral-400 flex-1 truncate">
            {inputValue || placeholder}
          </span>
          {cityContext && (
            <span className="text-xs text-neutral-500 shrink-0">{cityContext}</span>
          )}
        </button>
      )}

      {/* ── Mobile full-screen overlay ──────────────────────────
          Portaled to document.body: this component can render inside
          ancestors that have a Framer Motion `transform` applied (e.g. the
          hero intro animation), and any transformed ancestor becomes the
          containing block for `position: fixed` descendants — which would
          confine this "full-screen" overlay to the hero section's box
          instead of the viewport. Portaling escapes that ancestor chain. */}
      {isMobileExpanded && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setIsMobileExpanded(false)}
            aria-hidden="true"
          />

          {/* Overlay panel */}
          <div
            ref={overlayRef}
            className="fixed inset-0 z-50 bg-neutral-50 flex flex-col lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            {/* Header: back button + input */}
            <div className="flex items-center gap-2 px-3 pt-safe-top py-3 bg-neutral-0 border-b border-neutral-200">
              <button
                type="button"
                onClick={() => { setIsMobileExpanded(false); setIsOpen(false) }}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                aria-label="Close search"
              >
                <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
              </button>

              <div
                className={cn(
                  'flex-1 flex items-center gap-2 px-3 h-11 rounded-[10px]',
                  'bg-neutral-50 border',
                  isOpen ? 'border-amber-500' : 'border-neutral-200',
                  'transition-colors duration-fast',
                )}
              >
                <Search size={16} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
                {inputField}
                {inputValue && (
                  <button
                    type="button"
                    onClick={() => { setInputValue(''); inputRef.current?.focus() }}
                    className="shrink-0 text-neutral-400 hover:text-neutral-600 focus-visible:outline-none"
                    aria-label="Clear search"
                  >
                    <X size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => submit(inputValue)}
                className={cn(
                  'shrink-0 h-11 px-4 rounded-[10px] text-sm font-semibold',
                  'bg-amber-500 text-neutral-0',
                  'transition-colors duration-fast hover:bg-amber-600',
                  'focus-visible:outline-none focus-visible:shadow-brand',
                )}
              >
                Search
              </button>
            </div>

            {/* City indicator + GPS nudge */}
            <div className="px-4 py-2.5 bg-neutral-0 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">
                  {cityContext ? `Showing results in ${cityContext}` : 'Showing results in Abuja'}
                </span>
                {cityChip}
              </div>
              {permission === 'idle' && (
                <button
                  type="button"
                  onClick={requestLocation}
                  className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                >
                  <Navigation size={11} aria-hidden="true" />
                  Find restaurants near you
                </button>
              )}
            </div>

            {/* Suggestion list — inline (no separate panel on mobile) */}
            <div className="flex-1 overflow-y-auto bg-neutral-0">
              {dropdownVisible ? (
                suggestionList
              ) : (
                <div className="px-4 pt-6 pb-4">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                    Popular dishes
                  </p>
                  {anonRecentSearches.length > 0 ? (
                    <ul className="space-y-1">
                      {anonRecentSearches.map((item, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-neutral-50 transition-colors duration-fast"
                            onClick={() => submit(item.query)}
                          >
                            <Clock size={14} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
                            <span className="text-sm text-neutral-700">{item.query}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">Type a dish name to search</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
