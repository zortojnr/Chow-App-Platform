// Search TypeScript types — Step 12
//
// Central type hub for all search surfaces. Re-exports from services
// so consumers don't import directly from service files.
//
// Governed by: track-04-search-discovery.md §15.2 Step 12

export type { DishSearchResult } from 'features/search/services/dish-search.service'
export type { RestaurantSearchResult } from 'features/search/services/restaurant-search.service'
export type { DishRestaurantResult, MatchedDishContext } from 'features/search/services/dish-restaurant.service'
export type { SearchResponse, SearchParams, SearchType } from 'features/search/services/search.service'
export type { SuggestionResult } from 'features/search/services/suggestion.service'
export type { PopularDishResult, TrendingDishResult, JustVerifiedResult } from 'features/search/services/discovery.service'

import type { DishCategory } from '@prisma/client'

// ─── Category chip data ───────────────────────────────────────

export type CategoryChipItem = {
  slug: string
  label: string
  category: DishCategory
}

export const CATEGORY_CHIPS: CategoryChipItem[] = [
  { slug: 'rice',        label: 'Rice',        category: 'RICE_DISHES'  },
  { slug: 'soups',       label: 'Soups',       category: 'SOUPS'        },
  { slug: 'swallow',     label: 'Swallow',     category: 'SWALLOW'      },
  { slug: 'street-food', label: 'Street Food', category: 'STREET_FOOD'  },
  { slug: 'protein',     label: 'Protein',     category: 'PROTEIN'      },
  { slug: 'breakfast',   label: 'Breakfast',   category: 'BREAKFAST'    },
  { slug: 'drinks',      label: 'Drinks',      category: 'DRINKS'       },
  { slug: 'snacks',      label: 'Snacks',      category: 'SNACKS'       },
  { slug: 'desserts',    label: 'Desserts',    category: 'DESSERTS'     },
]

// ─── Category metadata for browse pages ──────────────────────

export type CategoryMeta = {
  slug: string
  label: string
  description: string
  category: DishCategory
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  rice:        { slug: 'rice',        label: 'Rice Dishes',  description: 'Jollof rice, fried rice, ofada, and more.',           category: 'RICE_DISHES'  },
  soups:       { slug: 'soups',       label: 'Soups',        description: 'Egusi, efo riro, ogbono, ofe onugbu, and more.',      category: 'SOUPS'        },
  swallow:     { slug: 'swallow',     label: 'Swallow',      description: 'Pounded yam, eba, amala, fufu, and more.',            category: 'SWALLOW'      },
  'street-food': { slug: 'street-food', label: 'Street Food', description: 'Suya, akara, boli, roasted corn, and more.',         category: 'STREET_FOOD'  },
  protein:     { slug: 'protein',     label: 'Protein',      description: 'Peppered snail, goat meat, assorted, and more.',      category: 'PROTEIN'      },
  breakfast:   { slug: 'breakfast',   label: 'Breakfast',    description: 'Akara and ogi, moi moi, yam and egg, and more.',      category: 'BREAKFAST'    },
  drinks:      { slug: 'drinks',      label: 'Drinks',       description: 'Zobo, kunu, fura de nono, palm wine, and more.',      category: 'DRINKS'       },
  snacks:      { slug: 'snacks',      label: 'Snacks',       description: 'Chin chin, puff puff, meat pie, scotch egg, more.',   category: 'SNACKS'       },
  desserts:    { slug: 'desserts',    label: 'Desserts',     description: 'Peanut cake, coconut candy, donkwa, and more.',       category: 'DESSERTS'     },
}

// ─── Availability display labels ─────────────────────────────

export const AVAILABILITY_LABELS: Record<string, string> = {
  ALWAYS_AVAILABLE: 'Always available',
  SEASONAL:         'Seasonal',
  WEEKEND_ONLY:     'Weekends only',
  ON_ORDER:         'On order',
  UNKNOWN:          '',
}
