# Chow Here — Frontend Standards

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Document:** master-architecture.md

---

## 0. PURPOSE

This document defines all frontend engineering standards for the Chow Here platform. It governs component architecture, state management, data fetching, form patterns, rendering strategy, and accessibility requirements.

These are not suggestions. Every frontend implementation decision must comply with this document.

---

## 1. RENDERING STRATEGY

### 1.1 The Rule: SEO-Critical Pages Are Server-Rendered

Chow Here's trust moat depends on Google indexing dish and restaurant pages with full structured data. The rendering strategy is dictated by this constraint.

| Page Type | Rendering Strategy | Reason |
|---|---|---|
| Home / search | SSR (Server Component) | Dynamic, SEO-critical |
| Restaurant profile `/restaurants/[slug]` | SSR (Server Component) | SEO, structured data |
| Dish page `/dishes/[slug]` | SSR (Server Component) | SEO, structured data |
| Search results `/search` | SSR with streaming | SEO + fast TTFB |
| User dashboard `/dashboard/*` | Client Component | Auth-gated, no SEO need |
| Admin dashboard `/admin/*` | Client Component | Auth-gated, no SEO need |
| Auth pages `/login`, `/register` | Client Component | Dynamic forms |

### 1.2 Server Components Are the Default

In Next.js App Router, components are Server Components by default. Add `'use client'` **only** when one of these is true:

- The component uses `useState` or `useReducer`
- The component uses `useEffect`
- The component uses browser APIs (`window`, `document`, `localStorage`)
- The component uses event handlers that require interactivity
- The component uses a React context that is client-side

**Never add `'use client'` pre-emptively.** The absence of `'use client'` is the correct default.

### 1.3 Streaming and Suspense

Server-rendered pages that have slow data dependencies must use `<Suspense>` with skeleton fallbacks. Never block the entire page render for a slow query.

```tsx
// app/(public)/restaurants/[slug]/page.tsx
export default async function RestaurantPage({ params }: Props) {
  return (
    <main>
      <RestaurantHeader slug={params.slug} />          {/* Fast — cached */}
      <Suspense fallback={<DishListSkeleton />}>
        <DishList restaurantSlug={params.slug} />      {/* May be slower */}
      </Suspense>
    </main>
  )
}
```

---

## 2. COMPONENT ARCHITECTURE

### 2.1 Component Classification

There are exactly four categories of components in Chow Here:

| Category | Location | Description |
|---|---|---|
| UI Primitives | `components/ui/` | Unstyled or minimally styled atoms (button, input, badge). From shadcn/ui. |
| Layout Components | `components/layout/` | Structural components used across the app (header, footer, container). |
| Feature Components | `features/[name]/components/` | Components that belong to a specific feature domain. |
| Page Compositions | `app/[route]/page.tsx` | Thin composition files. No business logic. |

### 2.2 Component Rules

**A component does one thing.** If a component renders UI and also manages server state and also handles form submission — it must be decomposed.

**File size limit: 150 lines per component file.**

**No business logic in components.** Business logic lives in service functions. Components consume data via hooks or Server Component props.

**No inline fetch calls in components.** Data flows into components via:
- Props (Server Components)
- Custom hooks using TanStack Query (Client Components)

### 2.3 Component Naming

```
RestaurantCard.tsx          — PascalCase, noun
DishSearchBar.tsx           — PascalCase, noun + role
VerificationStatusBadge.tsx — PascalCase, descriptive
useRestaurantSearch.ts      — camelCase with "use" prefix
```

Every component file exports exactly one component, named identically to the file.

### 2.4 Props Interface Convention

Every component must have an explicit Props interface:

```typescript
interface RestaurantCardProps {
  id: string
  name: string
  slug: string
  verificationStatus: VerificationStatus
  confidenceScore: number
  city: string
  thumbnailUrl: string | null
}

export function RestaurantCard({ id, name, slug, ...}: RestaurantCardProps) {
  // ...
}
```

Never use `React.FC`. Use plain function declarations with explicit props types.

---

## 3. STATE MANAGEMENT

### 3.1 State Categories and Where They Live

| State Type | Location | Tool |
|---|---|---|
| Server data (restaurants, dishes, search) | TanStack Query cache | TanStack Query v5 |
| Auth state (current user, role) | Zustand store | Zustand |
| UI state (modals, drawers open/closed) | Local `useState` | React |
| Form state | React Hook Form | RHF + Zod |
| URL state (search query, filters, pagination) | URL search params | `useSearchParams` |

### 3.2 TanStack Query Standards

All server data fetching in Client Components must go through TanStack Query:

```typescript
// features/restaurants/hooks/useRestaurant.ts
export function useRestaurant(id: string) {
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => fetchRestaurant(id),
    staleTime: 5 * 60 * 1000,       // 5 minutes
    gcTime: 30 * 60 * 1000,          // 30 minutes
  })
}
```

**Query key conventions:**
```typescript
['restaurants']                          // all restaurants
['restaurants', id]                      // single restaurant
['restaurants', id, 'dishes']           // dishes for restaurant
['search', { query, city, dish }]       // search results
```

Query keys are arrays, never strings. The first element is the resource name.

**Mutations:**
```typescript
export function useCreateRestaurant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRestaurantInput) => createRestaurant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}
```

### 3.3 Zustand Store Standards

Zustand is used **only** for:
- Auth state (current user, session)
- UI preferences (not persisted to DB)

```typescript
// lib/stores/auth.store.ts
interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
}))
```

Zustand stores are not used for server data. If you find yourself putting restaurant data or search results in Zustand, stop and use TanStack Query instead.

### 3.4 URL State Standards

Search queries, filters, and pagination state live in the URL — not in component state. This enables:
- Shareable search URLs
- Browser back/forward navigation
- SSR with correct initial state

```typescript
// Correct: search state in URL
const searchParams = useSearchParams()
const query = searchParams.get('q') ?? ''
const city = searchParams.get('city') ?? ''
const page = parseInt(searchParams.get('page') ?? '1')
```

---

## 4. DATA FETCHING PATTERNS

### 4.1 Server Component Data Fetching

In Server Components, fetch data directly from services or Prisma. Do not use TanStack Query in Server Components.

```typescript
// app/(public)/restaurants/[slug]/page.tsx
import { RestaurantService } from '@/features/restaurants/services/restaurant.service'

export default async function RestaurantPage({ params }: Props) {
  const restaurant = await RestaurantService.findBySlug(params.slug)
  
  if (!restaurant) {
    notFound()
  }

  return <RestaurantProfile restaurant={restaurant} />
}
```

### 4.2 API Fetch Wrapper

All API calls from Client Components go through a typed fetch wrapper in `lib/api.ts`:

```typescript
// lib/api.ts
export async function apiGet<T>(path: string): Promise<T>
export async function apiPost<T>(path: string, body: unknown): Promise<T>
export async function apiPatch<T>(path: string, body: unknown): Promise<T>
export async function apiDelete(path: string): Promise<void>
```

These helpers handle:
- Base URL construction
- JSON serialization
- Error parsing (maps API error shape to typed errors)
- Auth headers

Never call `fetch()` directly in hooks or components. Use the `api*` helpers.

---

## 5. FORM STANDARDS

### 5.1 Form Architecture

All forms use React Hook Form + Zod. The same Zod schema used for server-side validation is reused for client-side validation.

```typescript
// features/restaurants/schemas/restaurant.schema.ts
export const CreateRestaurantSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  // ...
})
```

```typescript
// features/restaurants/components/RestaurantIntakeForm.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateRestaurantSchema, CreateRestaurantInput } from '../schemas/restaurant.schema'

export function RestaurantIntakeForm() {
  const form = useForm<CreateRestaurantInput>({
    resolver: zodResolver(CreateRestaurantSchema),
    defaultValues: { name: '', address: '', city: '', state: '', phone: '', priceRange: 'MID' }
  })

  const mutation = useCreateRestaurant()

  async function onSubmit(data: CreateRestaurantInput) {
    await mutation.mutateAsync(data)
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

### 5.2 Form Rules

- Every form input shows inline validation errors below the field (not toasts)
- Server-side validation errors (422 responses) are mapped back to field-level errors via `form.setError()`
- Submission button is disabled while `isPending` is true
- Forms never reset to empty on submission failure
- Large multi-step forms (like the restaurant intake form) use a controlled step state, not multiple pages

### 5.3 File Upload Pattern

File uploads are a two-step process:
1. Client selects file → client-side size/type validation
2. File is POSTed to `/api/v1/upload` → server validates, uploads to Cloudinary, returns CDN URL
3. CDN URL is stored in form state and submitted with the rest of the form data

Files are never base64-encoded in JSON bodies. Always use `multipart/form-data` for uploads.

---

## 6. STYLING STANDARDS

### 6.1 TailwindCSS Rules

TailwindCSS is the only styling mechanism. No:
- CSS modules
- Styled-components
- CSS-in-JS
- Global custom CSS (except for `globals.css` resets and design tokens)

**Design tokens live in `tailwind.config.ts`:**

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: {
        primary: '#...',    // Chow Here primary
        secondary: '#...',
        accent: '#...',
      },
      verification: {
        verified: '#...',
        pending: '#...',
        rejected: '#...',
      }
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
    }
  }
}
```

Never use raw hex codes in component className strings. Use design token names.

### 6.2 Class Complexity Limit

If a component's className exceeds 5 Tailwind classes, use the `cn()` utility and extract to a named variable:

```typescript
const cardClasses = cn(
  'rounded-xl border bg-card shadow-sm',
  'hover:shadow-md transition-shadow',
  isVerified && 'border-brand-primary',
  className
)
```

The `cn()` utility is from `lib/utils.ts` (standard shadcn pattern: `clsx` + `tailwind-merge`).

### 6.3 shadcn/ui Component Policy

- Use shadcn/ui components as the base for all UI primitives
- Do not modify the generated component files in `components/ui/` — wrap them instead
- If a shadcn component needs customization, create a wrapper in the feature's `components/` directory

---

## 7. ACCESSIBILITY STANDARDS

### 7.1 Minimum Requirements (Phase 1)

Every interactive element must meet these requirements:

| Requirement | Standard |
|---|---|
| Images | `alt` text required. Decorative images use `alt=""`. |
| Form inputs | `<label>` associated via `htmlFor` or `aria-label` |
| Buttons | Descriptive text or `aria-label` if icon-only |
| Color contrast | WCAG AA minimum (4.5:1 for text) |
| Focus management | Visible focus ring on all interactive elements |
| Keyboard navigation | All interactions reachable via keyboard |

### 7.2 Semantic HTML First

Use semantic HTML before ARIA. A `<button>` is better than a `<div role="button">`. A `<nav>` is better than a `<div aria-role="navigation">`.

---

## 8. PERFORMANCE STANDARDS

### 8.1 Image Optimization

All images must use Next.js `<Image>` component, never `<img>`:

```tsx
import Image from 'next/image'

<Image
  src={restaurant.thumbnailUrl}
  alt={`${restaurant.name} restaurant`}
  width={400}
  height={300}
  className="rounded-lg object-cover"
  placeholder="blur"
  blurDataURL={restaurant.thumbnailBlurHash}
/>
```

### 8.2 Code Splitting

Route-level code splitting is automatic with Next.js App Router. Additional splitting rules:
- Heavy components (rich text editors, maps, charts) must be dynamically imported
- Admin-only components must not be bundled into the public JS bundle

```typescript
const AdminVerificationPanel = dynamic(
  () => import('@/features/admin/components/AdminVerificationPanel'),
  { loading: () => <Skeleton />, ssr: false }
)
```

### 8.3 Core Web Vitals Targets (Phase 1)

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | < 2.5s |
| CLS (Cumulative Layout Shift) | < 0.1 |
| INP (Interaction to Next Paint) | < 200ms |

Restaurant and dish pages must have explicit width/height on images to prevent CLS.

---

## 9. SEO STANDARDS

### 9.1 Metadata Generation

Every public page must export a `generateMetadata` function:

```typescript
// app/(public)/restaurants/[slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const restaurant = await RestaurantService.findBySlug(params.slug)
  if (!restaurant) return {}
  
  return {
    title: `${restaurant.name} — Verified Nigerian Restaurant | Chow Here`,
    description: `Discover verified dishes at ${restaurant.name} in ${restaurant.city}. ${restaurant.dishCount} dishes confirmed.`,
    openGraph: {
      title: restaurant.name,
      description: `...`,
      images: [{ url: restaurant.thumbnailUrl, width: 1200, height: 630 }],
    }
  }
}
```

### 9.2 Structured Data

Restaurant and dish pages must include JSON-LD structured data. The structured data helper lives in `lib/structured-data.ts`:

```typescript
export function restaurantStructuredData(restaurant: RestaurantProfile): WithContext<FoodEstablishment>
export function dishStructuredData(dish: DishProfile): WithContext<MenuItem>
```

Structured data is injected via `<script type="application/ld+json">` in the page layout.

### 9.3 Canonical URLs

Every public page must declare a canonical URL to prevent duplicate content indexing.

---

## 10. TESTING STANDARDS (Frontend)

See `testing-standards.md` for the full testing policy.

Frontend-specific requirements:
- Every shared UI component in `components/ui/` must have a rendering test
- Every custom hook must have a unit test using `renderHook` from `@testing-library/react`
- Critical user flows (search, restaurant intake form submission) must have end-to-end tests

---

*Governed by master-architecture.md. All conflicts resolved by that document.*
