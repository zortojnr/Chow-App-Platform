// features/search — Public API surface
//
// Import from this index, not directly from service files.
// Governed by: track-04-search-discovery.md §15.2

export { DishSearchService } from './services/dish-search.service'
export { RestaurantSearchService } from './services/restaurant-search.service'
export { DishRestaurantService } from './services/dish-restaurant.service'
export { SearchService } from './services/search.service'
export { SuggestionService } from './services/suggestion.service'
export { SearchLogService } from './services/search-log.service'

export type { DishSearchResult } from './services/dish-search.service'
export type { RestaurantSearchResult } from './services/restaurant-search.service'
export type { DishRestaurantResult, MatchedDishContext } from './services/dish-restaurant.service'
export type { SearchResponse, SearchType, SearchParams } from './services/search.service'
export type { SuggestionResult } from './services/suggestion.service'
