# Chow Here — Design System v1

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Date:** 2026-06-04  
**Governed by:** project-status-v1.md §17 — Product Experience & Design Vision

---

## Governance Rule

This document has architecture-level authority. No UI file — page or component — may be committed until the relevant section of this document covers it. Any UI decision not addressed here must be resolved in this document first, not in the component.

---

## 1. Brand Philosophy

### What Chow Here Is

Chow Here is not a restaurant directory. It is a trusted dish-first food discovery platform. Every design decision must serve one of two things: **trust** or **discovery**. If it serves neither, it does not belong.

### The Five Brand Feelings

Every screen must communicate all five simultaneously. If one is absent, the design has failed.

| Feeling | What It Means in Practice |
|---|---|
| **Trust** | Nothing unearned. Verification badges only on verified data. Clear signals. No dark patterns. |
| **Warmth** | Nigerian food is celebratory. The product must feel that way. Not clinical. Not cold. |
| **Confidence** | The platform knows what it is. No hedging. No generic placeholders. Strong type, clear hierarchy. |
| **Nigerian** | The color, photography, copy, and food vocabulary must feel rooted in Nigeria. Not generic "African." Not fusion. |
| **Premium simplicity** | Fewer elements, executed better. Every pixel has a reason. |

### What This Product Is Not

These aesthetics must be actively avoided. They are not accidents — they are easy defaults that must be consciously rejected.

- A generic SaaS dashboard
- A food delivery app (bright red CTAs, "Add to Cart" patterns)
- A directory listing site (dense tables, blue links, pagination numbers)
- A startup template (hero gradients, floating testimonial cards, feature grids)

### The Reference Frame

When making a design decision, ask: would this feel at home at Apple, Airbnb, or Google Maps? If the honest answer is no, reconsider.

---

## 2. Color System

### 2.1 Palette

The Chow Here palette is built on two brand colors and a warm-tinted neutral scale. The brand primary is palm amber — the color of palm oil, jollof rice broth, and turmeric. The trust color is Nigerian forest green, drawn from the national flag and the universal language of verification.

All grays carry a warm undertone. There are no cool-toned grays in this system.

#### Amber — Brand Primary

| Token | Hex | Use |
|---|---|---|
| `amber-50` | `#FFF8ED` | Tinted backgrounds, hover states |
| `amber-100` | `#FEEBC5` | Subtle backgrounds, chip fills |
| `amber-200` | `#FDD28A` | Decorative fills |
| `amber-300` | `#FBB343` | Illustrations, accents |
| `amber-400` | `#F99A18` | Large accent elements |
| `amber-500` | `#D4740A` | **Primary brand color** — CTAs, focus rings, active states |
| `amber-600` | `#B05E08` | Hover on primary buttons |
| `amber-700` | `#8A4906` | Pressed states |
| `amber-800` | `#6B3905` | Deep decorative use only |
| `amber-900` | `#4F2A04` | Near-black amber; text on amber backgrounds |

#### Forest Green — Trust

| Token | Hex | Use |
|---|---|---|
| `green-50` | `#F0F9F3` | Verified state backgrounds |
| `green-100` | `#D1EFD9` | Verified chip fills |
| `green-200` | `#A3DFB3` | Verified icon fills |
| `green-300` | `#6DC48A` | Decorative trust indicators |
| `green-400` | `#41A863` | Secondary trust accents |
| `green-500` | `#1B5E3B` | **Primary trust color** — verified badges, approved state, success |
| `green-600` | `#164D31` | Hover on trust elements |
| `green-700` | `#113C26` | Pressed trust states |
| `green-800` | `#0C2C1C` | Deep verified UI elements |
| `green-900` | `#071D12` | Trust color on light backgrounds, maximum contrast |

#### Neutral — Warm Tinted

All neutrals have a warm brown undertone. Never use pure `#FFFFFF` / `#000000` in UI surfaces.

| Token | Hex | Use |
|---|---|---|
| `neutral-0` | `#FFFFFF` | Floating surfaces over backgrounds only |
| `neutral-50` | `#FAFAF8` | **Page background** |
| `neutral-100` | `#F4F3F0` | Section backgrounds, card surfaces |
| `neutral-200` | `#E8E6E1` | Borders (default), dividers |
| `neutral-300` | `#D2CFC8` | Borders (strong), disabled outlines |
| `neutral-400` | `#B0ACA3` | Placeholder text, disabled text |
| `neutral-500` | `#888379` | Secondary icons, captions |
| `neutral-600` | `#635F57` | Body text (secondary) |
| `neutral-700` | `#47443D` | Body text (primary on light) |
| `neutral-800` | `#302D28` | Headings, strong body |
| `neutral-900` | `#1A1714` | **Primary text color** |
| `neutral-950` | `#100E0B` | Near-black; use for maximum contrast only |

#### Status Colors

| Token | Hex | Use |
|---|---|---|
| `status-error` | `#C0392B` | Errors, destructive actions |
| `status-error-bg` | `#FDF3F2` | Error message backgrounds |
| `status-warning` | `#C97B1A` | Warnings, caution states |
| `status-warning-bg` | `#FFFBF0` | Warning message backgrounds |
| `status-info` | `#1A6FA8` | Informational states |
| `status-info-bg` | `#F0F6FC` | Info message backgrounds |

#### Verification Status Colors

These map directly to `VerificationStatus` enum values and must be used consistently everywhere.

| Status | Color token | Background token | Label |
|---|---|---|---|
| `DRAFT` | `neutral-400` | `neutral-100` | Draft |
| `PENDING_REVIEW` | `amber-500` | `amber-50` | Pending Review |
| `NEEDS_INFO` | `status-info` | `status-info-bg` | Needs Information |
| `APPROVED` | `green-500` | `green-50` | Verified |
| `REJECTED` | `status-error` | `status-error-bg` | Not Approved |

### 2.2 Semantic Token Map

Components use semantic tokens, never raw palette values. This table is the contract.

| Semantic Token | Raw Value | Purpose |
|---|---|---|
| `color.brand` | `amber-500` | Primary brand interactions |
| `color.brand.hover` | `amber-600` | Brand element hover |
| `color.brand.pressed` | `amber-700` | Brand element pressed |
| `color.brand.subtle` | `amber-50` | Brand tinted backgrounds |
| `color.trust` | `green-500` | Verification, success, approval |
| `color.trust.subtle` | `green-50` | Verification backgrounds |
| `color.text.primary` | `neutral-900` | Body and heading text |
| `color.text.secondary` | `neutral-600` | Supporting text, captions |
| `color.text.tertiary` | `neutral-400` | Placeholders, disabled |
| `color.text.inverse` | `neutral-0` | Text on dark backgrounds |
| `color.text.on-brand` | `neutral-0` | Text on amber fills |
| `color.text.on-trust` | `neutral-0` | Text on green fills |
| `color.bg.base` | `neutral-50` | Page background |
| `color.bg.surface` | `neutral-0` | Card and modal surfaces |
| `color.bg.subtle` | `neutral-100` | Alternate section background |
| `color.bg.muted` | `neutral-200` | Chip fills, disabled fields |
| `color.border.default` | `neutral-200` | All default borders |
| `color.border.strong` | `neutral-300` | Emphasized borders |
| `color.border.focus` | `amber-500` | Focus ring color |
| `color.error` | `status-error` | Error text and icons |
| `color.error.bg` | `status-error-bg` | Error surface |
| `color.warning` | `status-warning` | Warning text and icons |
| `color.warning.bg` | `status-warning-bg` | Warning surface |
| `color.info` | `status-info` | Info text and icons |
| `color.info.bg` | `status-info-bg` | Info surface |

### 2.3 Usage Rules

- Never use `amber-500` on pure white without testing contrast. Check against `neutral-50` (page background).
- `green-500` on white passes AA at body sizes. Always verify contrast before using at small sizes.
- Do not use amber and green together as equals on the same element. One is always primary.
- Status colors are diagnostic. They must not be used for decoration.
- Never use a color from the Amber scale to communicate success. That is the green scale's job.

---

## 3. Typography System

### 3.1 Typefaces

#### Display — Fraunces

Used for hero headings, feature callouts, restaurant names in large treatments, and any text where emotional warmth matters.

Fraunces is an optical typeface — it draws from 20th-century advertising typography. At large sizes it has organic weight variation that feels crafted, not generated. It brings warmth without being decorative. It communicates that this platform was made with care.

```
font-family: 'Fraunces', Georgia, serif;
font-optical-sizing: auto;
```

Load weights: 400 (Regular), 600 (SemiBold), 700 (Bold).  
Load axes: `opsz` (optical size 9–144), `wght` (100–900), `SOFT` (0–100).

Use `SOFT=0` for authority and editorial presence. Use `SOFT=50` for warmth in conversational contexts.

#### UI — Plus Jakarta Sans

Used for all interface text: labels, buttons, inputs, body copy, navigation, tables, and admin surfaces.

Plus Jakarta Sans is a geometric humanist sans-serif. It is distinctly warmer than Inter — the terminals have character without being decorative. At small sizes it is highly legible. At large sizes it is clean and structured.

```
font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
```

Load weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold).

#### Mono — JetBrains Mono

Used exclusively for: submission reference IDs, admin data identifiers, confidence score values in admin detail views, and any context where character-level precision matters.

```
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

Load weights: 400 (Regular), 500 (Medium).

### 3.2 Type Scale

Base: 16px. Scale ratio: major second (1.125) for body/UI, major third (1.250) for display.

| Token | Size | Line Height | Tracking | Font | Use |
|---|---|---|---|---|---|
| `text-xs` | 11px | 16px | +0.04em | Plus Jakarta Sans | Micro labels, badges |
| `text-sm` | 12px | 18px | +0.02em | Plus Jakarta Sans | Captions, helper text, timestamps |
| `text-base` | 14px | 22px | 0 | Plus Jakarta Sans | Body text, form inputs, table content |
| `text-md` | 16px | 24px | 0 | Plus Jakarta Sans | Primary body text, default UI |
| `text-lg` | 18px | 28px | -0.01em | Plus Jakarta Sans | Large body, section intros |
| `text-xl` | 20px | 30px | -0.01em | Plus Jakarta Sans | Card headings, feature labels |
| `text-2xl` | 24px | 32px | -0.02em | Plus Jakarta Sans | Page section headings |
| `text-3xl` | 28px | 36px | -0.02em | Plus Jakarta Sans / Fraunces | Sub-page headings |
| `text-4xl` | 32px | 40px | -0.03em | Fraunces | Page headings |
| `text-5xl` | 40px | 48px | -0.03em | Fraunces | Feature headings |
| `text-6xl` | 48px | 56px | -0.04em | Fraunces | Hero subheadings |
| `text-7xl` | 60px | 68px | -0.04em | Fraunces | Hero headings |
| `text-8xl` | 80px | 88px | -0.05em | Fraunces | Display / campaign only |

### 3.3 Font Weight Usage

| Weight | Token | Use |
|---|---|---|
| 300 | `font-light` | Large decorative text only; never for body |
| 400 | `font-normal` | Body text, descriptions, secondary labels |
| 500 | `font-medium` | Navigation items, active labels, table headers |
| 600 | `font-semibold` | Button labels, form labels, card titles |
| 700 | `font-bold` | Page headings, critical callouts |

### 3.4 Type Rules

- Heading hierarchy is strict: one `text-4xl` or larger per page section. Never two.
- Line length for body copy: 60–72 characters. Constrain with `max-w-prose` or equivalent.
- Do not use light weight (300) for text smaller than `text-3xl`.
- Letter spacing tightens at larger sizes and loosens at smaller sizes — follow the scale exactly.
- Restaurant names in consumer UI: Fraunces at `text-2xl`+ with `font-semibold`. This is the brand identity of the listing.
- Admin data text (IDs, scores, counts): JetBrains Mono at `text-sm` or `text-base`. Never Plus Jakarta Sans for these.

---

## 4. Spacing System

Base unit: **4px**. All spacing values are multiples of 4px. Deviations require explicit justification.

| Token | px | rem | Use |
|---|---|---|---|
| `space-0` | 0 | 0 | — |
| `space-0.5` | 2px | 0.125rem | Hairline gaps, icon nudges |
| `space-1` | 4px | 0.25rem | Tight internal padding (badge, chip) |
| `space-1.5` | 6px | 0.375rem | Dense list items |
| `space-2` | 8px | 0.5rem | Icon-to-label gap, tight padding |
| `space-2.5` | 10px | 0.625rem | Compact input padding |
| `space-3` | 12px | 0.75rem | Button horizontal padding (small) |
| `space-4` | 16px | 1rem | Default component internal padding |
| `space-5` | 20px | 1.25rem | Card internal padding |
| `space-6` | 24px | 1.5rem | Section gap (tight) |
| `space-7` | 28px | 1.75rem | — |
| `space-8` | 32px | 2rem | Section gap (default) |
| `space-10` | 40px | 2.5rem | Section gap (comfortable) |
| `space-12` | 48px | 3rem | Component vertical rhythm |
| `space-14` | 56px | 3.5rem | Large section gap |
| `space-16` | 64px | 4rem | Page section padding |
| `space-20` | 80px | 5rem | Hero padding |
| `space-24` | 96px | 6rem | Large hero padding |
| `space-32` | 128px | 8rem | Maximum section gap |

### Layout Grid

| Breakpoint | Columns | Gutters | Margins |
|---|---|---|---|
| Mobile (`< 640px`) | 4 | 16px | 16px |
| Tablet (`640–1023px`) | 8 | 24px | 24px |
| Desktop (`1024–1279px`) | 12 | 24px | 32px |
| Wide (`1280px+`) | 12 | 32px | 48px |
| Max content width | — | — | `1280px` |

---

## 5. Radius System

| Token | Value | Use |
|---|---|---|
| `radius-none` | `0` | Flush/edge-to-edge elements |
| `radius-sm` | `4px` | Tight chips, small badges, table row highlights |
| `radius-DEFAULT` | `8px` | Inputs, small buttons, compact cards |
| `radius-md` | `10px` | Standard buttons, form controls |
| `radius-lg` | `12px` | Cards (default), dropdown menus, popovers |
| `radius-xl` | `16px` | Feature cards, photo containers |
| `radius-2xl` | `20px` | Modal dialogs, bottom sheets |
| `radius-3xl` | `28px` | Full-featured cards, hero image containers |
| `radius-full` | `9999px` | Pills, circular avatars, toggle tracks |

### Radius Usage Rules

- Input fields: `radius-DEFAULT` (8px).
- Primary buttons: `radius-md` (10px).
- Cards in consumer UI: `radius-xl` (16px) or `radius-3xl` (28px) for photo-forward cards.
- Cards in admin UI: `radius-lg` (12px) — denser, less decorative.
- Modals: `radius-2xl` (20px), with no radius on bottom when used as a bottom sheet on mobile.
- Status badges: `radius-full` — always pill-shaped.
- Avatars: `radius-full` — always circular.

---

## 6. Shadow System

All shadows use warm-tinted umbra values, not neutral gray. The shadow color is `rgba(26, 23, 20, N)` — the warm near-black from `neutral-900`.

| Token | Value | Use |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(26,23,20,0.06)` | Subtle card lift on flat backgrounds |
| `shadow-sm` | `0 1px 3px rgba(26,23,20,0.08), 0 1px 2px rgba(26,23,20,0.04)` | Default card, chip |
| `shadow-DEFAULT` | `0 4px 6px rgba(26,23,20,0.07), 0 2px 4px rgba(26,23,20,0.04)` | Hovered card, input focus ring area |
| `shadow-md` | `0 8px 16px rgba(26,23,20,0.08), 0 4px 6px rgba(26,23,20,0.04)` | Dropdown menus, popovers |
| `shadow-lg` | `0 16px 32px rgba(26,23,20,0.10), 0 6px 12px rgba(26,23,20,0.06)` | Modal dialogs, sheet overlays |
| `shadow-xl` | `0 24px 48px rgba(26,23,20,0.14), 0 8px 16px rgba(26,23,20,0.06)` | Elevated modals, command palettes |
| `shadow-brand` | `0 0 0 3px rgba(212,116,10,0.24)` | Focus ring for brand-colored elements |
| `shadow-trust` | `0 0 0 3px rgba(27,94,59,0.20)` | Focus ring for trust-colored elements |

### Shadow Rules

- Cards on `neutral-50` (page background): `shadow-sm`. On `neutral-100` (section background): `shadow-DEFAULT`.
- Do not combine shadow with a visible border. Choose one.
- Focus rings (`shadow-brand`, `shadow-trust`) replace outlines. Always visible on keyboard navigation — never remove.
- No shadows on admin table rows. Use hover background fill instead.

---

## 7. Motion and Animation System

### 7.1 Core Principle

Every animation must pass all four tests: **Fast. Subtle. Purposeful. Premium.**

An animation fails if it is noticed while playing. It succeeds if it is noticed only when removed.

### 7.2 Duration Scale

| Token | Value | Use |
|---|---|---|
| `duration-instant` | `0ms` | State-dependent visibility toggles (no animation needed) |
| `duration-fast` | `100ms` | Hover states, focus transitions, color changes |
| `duration-normal` | `200ms` | Micro-interactions: button press, badge update, status change |
| `duration-slow` | `300ms` | Entrance/exit of small elements: tooltips, dropdowns |
| `duration-page` | `400ms` | Route transitions, modal appearance |
| `duration-elaborate` | `500ms` | Multi-part entrances (staggered lists, skeleton-to-content) |

**Hard limit:** No single animation exceeds `500ms`. No user-initiated interaction animation exceeds `300ms`.

### 7.3 Easing Curves

```css
--ease-out:     cubic-bezier(0.0, 0.0, 0.2, 1);   /* Entrances — starts fast, ends gentle */
--ease-in:      cubic-bezier(0.4, 0.0, 1, 1);      /* Exits — starts gentle, ends fast */
--ease-in-out:  cubic-bezier(0.4, 0.0, 0.2, 1);    /* State changes — symmetric */
--ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1); /* Micro spring — badge pop, success tick */
--ease-linear:  linear;                             /* Progress bars, loaders ONLY */
```

**Rule:** Never use `linear` easing for interaction animations. It feels mechanical.

### 7.4 Standard Transitions

| Interaction | Duration | Easing | Properties |
|---|---|---|---|
| Button hover | `100ms` | `ease-out` | `background-color`, `box-shadow` |
| Button press | `100ms` | `ease-in` | `transform: scale(0.98)`, `background-color` |
| Input focus | `150ms` | `ease-out` | `box-shadow` (focus ring), `border-color` |
| Card hover (consumer) | `200ms` | `ease-out` | `transform: translateY(-2px)`, `box-shadow` |
| Card press | `100ms` | `ease-in` | `transform: translateY(0)` |
| Status badge change | `200ms` | `ease-spring` | `background-color`, `color` |
| Dropdown open | `200ms` | `ease-out` | `opacity 0→1`, `transform: translateY(-4px)→translateY(0)` |
| Dropdown close | `150ms` | `ease-in` | `opacity 1→0`, `transform: translateY(0)→translateY(-4px)` |
| Modal enter | `300ms` | `ease-out` | Backdrop: `opacity 0→1`. Dialog: `opacity 0→1`, `scale(0.97)→scale(1)` |
| Modal exit | `200ms` | `ease-in` | Backdrop + dialog: reverse |
| Bottom sheet enter | `350ms` | `ease-out` | `translateY(100%)→translateY(0)` |
| Bottom sheet exit | `250ms` | `ease-in` | `translateY(0)→translateY(100%)` |
| Toast enter | `300ms` | `ease-spring` | `translateY(16px)→translateY(0)`, `opacity 0→1` |
| Toast exit | `200ms` | `ease-in` | `opacity 1→0` |
| Route transition | `400ms` | `ease-in-out` | `opacity 0→1` on incoming page |
| Skeleton shimmer | `1400ms` | `ease-in-out` | `background-position` (infinite loop) |

### 7.5 Stagger

When multiple elements enter simultaneously (search results, queue items), stagger each by `40ms`. Maximum stagger chain: 6 items (240ms total). Items beyond 6 enter together at the final offset.

```css
.item:nth-child(1) { animation-delay: 0ms; }
.item:nth-child(2) { animation-delay: 40ms; }
.item:nth-child(3) { animation-delay: 80ms; }
/* ... up to 6 */
```

### 7.6 Reduced Motion

All animations must respect `prefers-reduced-motion`. When the preference is `reduce`:
- Duration collapses to `0ms` for all entrance/exit animations
- Skeleton shimmer stops (static background instead)
- Hover transforms are removed (color changes remain)
- Page transitions are instant

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.7 Prohibited Animations

- Bouncing (anything with overshoot beyond `ease-spring` on small elements)
- Rotating loaders on operations completing in < 300ms
- Parallax effects on any scroll surface
- Scroll-triggered entrance animations on consumer pages
- Auto-playing video or motion backgrounds
- Infinite decorative animations (pulsing, floating, etc.)

---

## 8. Accessibility Standards

### 8.1 Minimum Standard: WCAG 2.1 AA

This is the floor, not the target. Where AA and AAA are achievable at no design cost, choose AAA.

### 8.2 Contrast Ratios

| Context | Minimum Ratio |
|---|---|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 |
| Large text (≥ 18pt / ≥ 14pt bold) | 3:1 |
| UI components and graphical objects | 3:1 |
| Disabled elements | No requirement |
| Decorative elements | No requirement |

#### Pre-checked critical pairs

| Foreground | Background | Ratio | Pass |
|---|---|---|---|
| `neutral-900` on `neutral-50` | Text on page | 16.1:1 | AAA |
| `neutral-900` on `neutral-0` | Text on white surface | 17.9:1 | AAA |
| `neutral-0` on `amber-500` | Text on brand button | 4.6:1 | AA |
| `neutral-0` on `green-500` | Text on trust button | 6.0:1 | AA |
| `amber-500` on `neutral-50` | Brand text on page | 3.9:1 | AA large only — do not use for body text |
| `green-500` on `neutral-50` | Trust text on page | 5.8:1 | AA |
| `status-error` on `neutral-50` | Error text on page | 5.2:1 | AA |

**Warning:** `amber-500` on `neutral-50` does not pass for normal body text. Never use amber as body text color. Use it for large text, icons, and filled elements only.

### 8.3 Keyboard Navigation

- Every interactive element is keyboard reachable.
- Tab order follows visual reading order (top-left to bottom-right, no DOM reordering that breaks tab flow).
- Focus rings are always visible. Never `outline: none` without replacing with a custom focus style.
- Focus ring: `shadow-brand` for amber elements, `shadow-trust` for green elements, `0 0 0 3px rgba(26,23,20,0.24)` for neutral elements.
- Modal dialogs trap focus when open. Focus returns to the trigger element on close.
- Dropdown menus support arrow key navigation, Escape to close, Enter/Space to select.

### 8.4 ARIA Patterns

| Component | Required ARIA |
|---|---|
| Status badge | `role="status"` if it updates dynamically |
| Confidence score widget | `aria-label="Confidence score: X%"` on the value |
| Loading skeleton | `aria-busy="true"` on the container, `aria-hidden="true"` on skeleton elements |
| Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to heading |
| Toast | `role="status"` (non-critical) or `role="alert"` (critical errors) with `aria-live` |
| Dropdown menu | `role="menu"`, children `role="menuitem"` |
| Admin queue table | `role="table"`, `scope="col"` on headers |
| Verification status | `aria-label` describing full status name, not abbreviation |
| Photo grid | Each photo: `alt` text required. Admin verify button: `aria-label="Mark photo as verified"` |
| Typeahead search | `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` |

### 8.5 Touch Targets

All interactive elements must meet minimum touch target sizes:

| Context | Minimum size |
|---|---|
| Primary actions (buttons) | 44×44px |
| Secondary actions (icon buttons) | 40×40px |
| List items | 48px height minimum |
| Checkbox / radio | 24×24px visual, 44×44px touch area |
| Inline links | Not recommended for mobile; use button-style targets |

---

## 9. Mobile-First Standards

### 9.1 Principle

Every component is designed for mobile first. Desktop is an enhancement, not the default. If a design only works at desktop width, it is not finished.

### 9.2 Breakpoints

| Name | Min width | Description |
|---|---|---|
| `xs` | 0px | Base (mobile portrait) |
| `sm` | 480px | Mobile landscape |
| `md` | 640px | Large mobile / small tablet |
| `lg` | 1024px | Tablet landscape / small desktop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Wide desktop |

CSS-in-Tailwind terms: `sm`, `md`, `lg`, `xl`, `2xl` map to the above.

### 9.3 Thumb Zone

On a standard mobile screen (375px–430px wide), the primary action zone is the lower 60% of the screen. Navigation and CTAs should appear in the thumb zone. Search is top-of-screen but must be reachable with a single tap.

```
┌─────────────────┐
│   Status bar    │
│─────────────────│ ← Hard to reach (one-handed)
│   Header / Nav  │
│                 │
│   Content area  │
│                 │
│─────────────────│ ← Comfortable zone begins
│   Sticky CTA    │
│   Bottom Nav    │ ← Primary navigation lives here
└─────────────────┘
```

### 9.4 Consumer Mobile Navigation

The consumer experience uses a bottom navigation bar on mobile (≤ `lg` breakpoint) and a top navigation bar on desktop. The bottom nav has a maximum of 4 items plus an overflow menu.

### 9.5 Admin Mobile

The admin UI is used primarily on desktop. On tablet it must be usable; on mobile it must be functional but is not optimised. The admin queue must be operable on tablet (1024px+). The review screen may require horizontal scroll on smaller viewports — this is acceptable for admin.

### 9.6 Mobile Typography Rules

- Never use `text-xs` (11px) for readable content on mobile. Minimum body text on mobile: `text-sm` (12px), recommended `text-base` (14px).
- Display typography (`text-5xl` and larger) scales down on mobile. A `text-7xl` heading on desktop becomes `text-4xl` on mobile.
- Line lengths on mobile: 100% viewport width minus padding. Do not constrain with `max-w-prose` on mobile.

### 9.7 Viewport Meta

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

`viewport-fit=cover` ensures the app extends behind notch/home indicator areas (safe area insets handle the padding).

---

## 10. Component Library

This section defines every component's specification. Components are built from these specs — the spec is not derived from the implementation.

### 10.1 Buttons

#### Variants

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `amber-500` | `neutral-0` | None | The one CTA per screen |
| Secondary | `neutral-0` | `neutral-900` | `neutral-300` | Supporting actions |
| Ghost | Transparent | `neutral-700` | None | Tertiary, destructive actions |
| Trust | `green-500` | `neutral-0` | None | Approve, verify, confirm trust |
| Destructive | `status-error` | `neutral-0` | None | Irreversible destructive actions |
| Outline Brand | Transparent | `amber-500` | `amber-500` | Brand-adjacent secondary |

#### Sizes

| Size | Height | Horizontal padding | Font | Use |
|---|---|---|---|---|
| `xs` | 28px | `space-3` (12px) | `text-xs` semibold | Admin compact controls |
| `sm` | 32px | `space-4` (16px) | `text-sm` semibold | Dense UI, inline actions |
| `DEFAULT` | 40px | `space-5` (20px) | `text-base` semibold | Standard buttons |
| `lg` | 48px | `space-6` (24px) | `text-md` semibold | Primary CTAs, form submits |
| `xl` | 56px | `space-8` (32px) | `text-lg` semibold | Hero CTAs |

#### States

- **Default**: base color
- **Hover**: transition `100ms ease-out` to hover variant (see shadow system)
- **Pressed**: `scale(0.98)`, pressed color, `100ms ease-in`
- **Focused**: base color + `shadow-brand` focus ring
- **Loading**: spinner replaces label, button disabled, opacity unchanged
- **Disabled**: opacity `0.40`, cursor not-allowed, no hover effect

#### Icon Buttons

Square variant of the button. Same height/width. Icon centered. Required `aria-label`.

### 10.2 Inputs

#### Text Input

```
Border:       1.5px solid neutral-200 (resting)
              1.5px solid amber-500 (focused)
              1.5px solid status-error (error)
Background:   neutral-0 (resting), neutral-0 (focused), status-error-bg (error)
Height:       44px (default), 36px (compact)
Padding:      12px 16px
Radius:       radius-DEFAULT (8px)
Font:         text-base, neutral-900, Plus Jakarta Sans
Placeholder:  neutral-400
Focus ring:   shadow-brand (3px amber halo, no outline)
```

#### Textarea

Same as Text Input. Min height 120px. Resizes vertically. No horizontal resize.

#### Select

Same as Text Input. Dropdown arrow icon (Lucide `ChevronDown`, `neutral-500`). Opens as a native select on mobile, custom dropdown on desktop.

#### Checkbox

24×24px visual box. `radius-sm`. Unchecked: `neutral-0` background, `neutral-300` border. Checked: `amber-500` background, `amber-500` border, white checkmark. Focus ring: `shadow-brand`.

#### Toggle

Track: 40×24px, `radius-full`. Thumb: 20×20px circle, `neutral-0`. Off: track `neutral-300`. On: track `amber-500`. Transition `200ms ease-in-out` on both track color and thumb position.

### 10.3 Cards

#### Restaurant Card (Consumer)

```
Surface:    neutral-0
Radius:     radius-xl (16px) or radius-3xl (28px) for featured cards
Shadow:     shadow-sm (resting), shadow-DEFAULT (hovered)
Hover:      translateY(-2px), 200ms ease-out
Padding:    space-5 (20px) inside content area
Photo:      Aspect ratio 4:3, radius-xl top corners, object-cover
```

Structure (top to bottom):
1. Photo — full width, 4:3 ratio
2. Verification badge — overlaid on photo, bottom-left (green pill)
3. Restaurant name — Fraunces, `text-2xl`, `font-semibold`, `neutral-900`
4. Cuisine tags — pills, `neutral-100` fill, `text-sm`
5. Location — icon + text, `text-sm`, `neutral-600`
6. Confidence score indicator — subtle trust bar (admin-facing only; consumer sees simplified verified indicator)

#### Admin Queue Card

Compact, dense, information-first. No photography. Optimised for scanning.

```
Surface:    neutral-0
Radius:     radius-lg (12px)
Shadow:     none (use border instead)
Border:     1px solid neutral-200
Hover:      neutral-50 background, 100ms ease-out
```

Structure: Restaurant name | Status badge | City | Assigned | Age | Score pill | Action chevron.

#### Confidence Score Widget (Admin)

Shows overall score (large mono number) + per-signal breakdown (7 rows). Each signal: label, binary result (green check / gray dash), weight value.

```
Score number:     JetBrains Mono, text-5xl, font-bold
Score color:      < 0.40: status-error | 0.40–0.69: status-warning | 0.70+: green-500
Signal rows:      text-sm, neutral-700
Signal earned:    green-500 check icon, green-50 row background
Signal missing:   neutral-300 dash icon, neutral-0 row background
```

### 10.4 Badges

All badges are pill-shaped (`radius-full`). Text: `text-xs`, `font-semibold`. Height: 22px. Padding: `4px 10px`.

| Variant | Background | Text | Use |
|---|---|---|---|
| Verified | `green-50` | `green-700` | APPROVED status |
| Pending | `amber-50` | `amber-700` | PENDING_REVIEW status |
| Needs Info | `status-info-bg` | `status-info` | NEEDS_INFO status |
| Draft | `neutral-100` | `neutral-500` | DRAFT status |
| Rejected | `status-error-bg` | `status-error` | REJECTED status |
| Price Budget | `neutral-100` | `neutral-600` | ₦ price range |
| Price Mid | `amber-50` | `amber-700` | ₦₦ price range |
| Price Upscale | `neutral-900` | `neutral-50` | ₦₦₦ price range |
| Category | `neutral-100` | `neutral-700` | DishCategory |

### 10.5 Navigation

#### Consumer Top Navigation (Desktop)

Height: 64px. Background: `neutral-0`. Border-bottom: `1px solid neutral-200`. Sticky.

Left: Chow Here wordmark (Fraunces, `text-xl`, `amber-500`).  
Center: Search bar (full-width input, max 600px).  
Right: Login / Profile avatar.

#### Consumer Bottom Navigation (Mobile)

Height: 60px + safe area inset. Background: `neutral-0`. Border-top: `1px solid neutral-200`. Fixed.

Items: Discover (home) | Search | Saved | Profile. Active: `amber-500` icon + label. Inactive: `neutral-400`.

#### Admin Sidebar (Desktop)

Width: 240px. Background: `neutral-950`. Text: `neutral-300` (inactive), `neutral-0` (active).

Items: Queue | Restaurants | Dishes | Analytics | Settings. Active item: left border `amber-500` (3px), text `neutral-0`, background `neutral-800`.

### 10.6 Modals and Sheets

#### Dialog Modal

Width: 480px (small), 640px (default), 800px (wide). Radius: `radius-2xl`. Shadow: `shadow-xl`. Backdrop: `rgba(26,23,20,0.48)` blur `4px`.

Structure: Header (title + close button) | Divider | Content | Divider | Footer (actions, right-aligned).

#### Bottom Sheet (Mobile)

Full width. Radius: `radius-2xl` top-left and top-right only, 0 on bottom. Handle bar at top: `40px wide, 4px tall, neutral-300, radius-full`. Max height: 90vh. Scrollable content.

### 10.7 Tables (Admin)

```
Header row:   neutral-100 background, text-sm font-semibold neutral-500, uppercase tracking
Body rows:    neutral-0 background, text-base neutral-900
Hover row:    neutral-50 background, 100ms ease-out
Selected row: amber-50 background
Dividers:     1px solid neutral-100 (horizontal only)
Cell padding: 12px 16px
```

No vertical dividers. No outer border on the table itself.

### 10.8 Toasts and Notifications

Position: Bottom-right (desktop), bottom-center (mobile). Z-index: highest.

| Type | Left border | Icon | Use |
|---|---|---|---|
| Success | `green-500`, 3px | Check circle | Approval sent, save confirmed |
| Error | `status-error`, 3px | X circle | Action failed |
| Warning | `status-warning`, 3px | Alert triangle | Caution required |
| Info | `status-info`, 3px | Info circle | Neutral information |

Auto-dismiss: 4 seconds (info/success), 8 seconds (warning/error), never (critical errors requiring action).

### 10.9 Dish Typeahead

Input expands to a dropdown list on focus/typing. Results: dish name (`text-base`, `font-medium`), category badge, right-aligned keyboard shortcut hint.

No result state: "No dishes match. The admin will add it during review." — never show an empty state that implies an error.

Minimum query: 2 characters. Maximum results: 20. Debounce: 150ms.

### 10.10 Photo Grid (Admin)

3-column grid on desktop, 2-column on tablet. Each photo cell:
- Photo fills the cell (object-cover, 1:1 aspect)
- Verified: `green-500` checkmark badge overlay, bottom-right
- Unverified: no badge
- Primary: crown icon overlay, top-left
- Hover: dark overlay with "Verify" / "Set Primary" action buttons

---

## 11. Admin UI Language

The admin UI is an operational tool. The design language is dense, efficient, and diagnostic. It is not decorative.

### 11.1 Principles

- **Information density over whitespace.** Admins need to see more per viewport, not less.
- **No consumer-facing warmth.** Admin surfaces use `neutral-100` backgrounds, not the rich warmth of consumer pages.
- **Every row is an action.** Queue items, dish rows, photo cells — all are interactive.
- **Data before chrome.** UI shell (nav, headers) occupies minimum space. Content is maximum space.
- **Audit always visible.** The event timeline is never hidden or collapsed by default.

### 11.2 Admin Color Overrides

While the admin UI uses the same token system, the following adjustments apply:

- Page background: `neutral-100` (slightly denser than consumer's `neutral-50`)
- Sidebar: `neutral-950` (near-black, authoritative)
- Active sidebar item: `amber-500` left border, `neutral-0` text
- Cards: `neutral-0` surface with `1px solid neutral-200` border, no shadow

### 11.3 Admin Typography Scale

Admin type sizes skew smaller. The primary admin text size is `text-sm` (12px) for dense data, `text-base` (14px) for primary content. Headings are capped at `text-2xl` (24px).

Admin does not use Fraunces. All admin text is Plus Jakarta Sans, with JetBrains Mono for IDs and scores.

### 11.4 Admin Action Hierarchy

On any admin action screen, action buttons follow this fixed hierarchy:

1. **Approve** — `Trust` variant, rightmost or topmost
2. **Request Info** — `Secondary` variant, center
3. **Reject** — `Ghost` or `Destructive` variant, leftmost or bottommost

Reject requires a confirmation modal. Approve with score below 0.40 requires a blocking error — the button does not show a confirmation modal, it shows the validation error immediately.

### 11.5 Admin Status Language

| Status | Admin label | Admin description |
|---|---|---|
| DRAFT | Draft | Submission started, not yet reviewed |
| PENDING_REVIEW | Pending Review | In queue, awaiting review |
| NEEDS_INFO | Needs Information | Admin requested clarification |
| APPROVED | Verified | Approved and live on platform |
| REJECTED | Not Approved | Declined |

---

## 12. Restaurant Submitter UI Language

The submitter experience is the first time many users interact with Chow Here. They are contributing knowledge. The design must communicate that their contribution matters and that the process is fair and transparent.

### 12.1 Principles

- **Transparency over mystery.** Every state in the verification process has a clear human-readable explanation.
- **Progress, not waiting.** Status screens tell submitters what is happening, not just where they are.
- **Never clinical.** The submitter is doing something generous. The UI must acknowledge that.
- **Trust without intimidation.** Validation errors must explain, not accuse.

### 12.2 Intake Form Language

Multi-step wizard. Progress indicator at top (step X of 4). Back/Next navigation.

| Step | Title | Primary CTA |
|---|---|---|
| Step 1 | "Tell us about the restaurant" | "Continue" |
| Step 2 | "Which dishes do they serve?" | "Continue" |
| Step 3 | "Add some photos (optional)" | "Continue" / "Skip" |
| Step 4 | "Almost done — review your submission" | "Submit Restaurant" |

Success screen headline: "Thank you — your submission is in review."  
Sub-copy: "We'll email you when our team has reviewed it. This usually takes a few days."  
Reference ID display: JetBrains Mono, amber-500, `text-lg`.

### 12.3 Status Communication

When a submitter views their submission status:

| Status | Headline | Body |
|---|---|---|
| PENDING_REVIEW | "Your submission is in our review queue" | "Our team reviews every restaurant personally. We'll be in touch soon." |
| NEEDS_INFO | "We need a bit more information" | Admin's `feedbackToSubmitter` text. Then: "Please respond using the link in your email." |
| APPROVED | "Your restaurant is now on Chow Here" | "Thank you for helping build the platform. [View listing]" |
| REJECTED | "We couldn't approve this submission" | Admin's sanitised feedback. No apology, no bureaucratic language. Honest. |

### 12.4 Validation Error Language

Form errors must:
- Explain what is wrong, not just that it is wrong
- Not use technical terms (e.g. "Invalid format" → "Use a Nigerian phone number, like 0801 234 5678")
- Never use the word "invalid" alone
- For Nigerian phone: "Please enter a Nigerian phone number (e.g., 0801 234 5678 or +234 801 234 5678)"

---

## 13. Consumer UI Language

The consumer experience is the product's public face. This is what Chow Here is. Every screen is a product statement.

### 13.1 Principles

- **Dish-first, always.** The search bar is the hero. Restaurant names are secondary.
- **Photography is substance, not decoration.** Food photos are the primary trust signal for consumers. They must be large, crisp, and unobstructed.
- **Trust signals are quiet.** The verified badge tells the user this is a confirmed listing. It should not dominate — it should reassure.
- **Scarcity is a feature.** Fewer, better results. Never show unverified restaurants alongside verified ones. Never pad results with low-confidence listings.
- **Location is ambient.** The user should never need to type their location. Proximity should surface naturally.

### 13.2 Search Experience

Search input: `text-lg`, full-width, height 52px on desktop/48px on mobile. Placeholder: "Search for a dish..." (not "Search restaurants").

Results appear below in a card grid (2 columns mobile, 3 columns tablet, 4 columns desktop). Each result is a Restaurant Card as defined in §10.3.

No results state: "No verified restaurants serve [query] in [location]" — never "No results found." Always specific.

### 13.3 Restaurant Profile Page

Structure (mobile, scrolling):
1. Hero photo — full-width, 16:9 ratio, object-cover
2. Restaurant name — Fraunces, `text-4xl`, `font-bold`, `neutral-900`
3. Verified badge + score band label (Excellent / Strong / etc.)
4. Location line — icon + address, `text-base`, `neutral-600`
5. Price range badge + cuisine type badges
6. Dishes section — full-width, scrollable horizontal chip list, then dish cards below
7. Contact / website / map link
8. About — description text

### 13.4 Consumer Copy Standards

- All copy is direct, warm, and specific to Nigerian food culture.
- Use ₦ (Naira symbol) for prices, not "NGN".
- Use Nigerian place names as-is: "Lekki", "Wuse", "Opebi" — not anglicized versions.
- Dish names use the canonical taxonomy name. Common aliases shown in smaller text below.
- "Verified" not "Approved" in consumer-facing contexts.
- Never "Listing" — always "Restaurant."

---

## 14. Map and Navigation Experience

This section governs the future navigation vision documented in project-status-v1.md §17. No map features are implemented in Phase 1. This section preserves the design direction so Phase 1 decisions do not close off this path.

### 14.1 The Journey

```
Dish Search → Restaurant Match → Distance Ranking
  → Route Preview → Turn-by-Turn Navigation
  → Real-Time Tracking → Arrival Confirmation
```

### 14.2 Map Aesthetic

When the map layer is implemented, it must use a custom map style — not default Google Maps or Mapbox. The map style must:
- Match the warm neutral palette of the product (muted terrain, warm off-white land, amber-tinted roads)
- Suppress points of interest not relevant to food (reduce visual noise)
- Use Chow Here restaurant markers: circular, white border, amber-tinted, with a subtle food icon
- Verified restaurants: green outer ring on marker

### 14.3 Phase 1 Constraints That Must Not Close Off Navigation

- The database schema must not omit location fields. `Restaurant.address`, `city`, `state`, and `area` are present. Latitude/longitude will be added as nullable columns in Phase 2.
- The URL structure for restaurant pages uses `/restaurants/[slug]` — this slug becomes the deep-link anchor for navigation handoff.
- Consumer page layouts must not be built with fixed-height containers that would prevent a map panel from being added at the bottom or side in a future iteration.

### 14.4 Turn-by-Turn Navigation Vision

When implemented, navigation is in-product — not a handoff to Google Maps or Apple Maps. The experience:
- Shows the restaurant as the destination
- Displays route on the Chow Here map
- Provides step-by-step instructions in Nigerian street naming conventions
- Confirms arrival and closes the discovery loop with a prompt: "Did you eat there? Let us know."

This arrival confirmation is the eventual bridge to user-generated quality signals (Phase 2+).

---

## 15. Empty States

Every empty state must be:
- **Specific** — explain what is empty and why, in context
- **Actionable** — provide a clear next step
- **Honest** — never imply an error if the state is expected
- **Warm** — not a generic illustration of a box or search icon

### 15.1 Empty State Structure

1. Illustration or icon — simple, on-brand, 80×80px max on mobile
2. Headline — Fraunces, `text-2xl`, `font-semibold`, `neutral-800`
3. Body copy — Plus Jakarta Sans, `text-base`, `neutral-600`, max 2 lines
4. CTA — Primary button (when there is an action) or none (when there is not)

### 15.2 Per-Context Empty States

| Context | Illustration concept | Headline | Body | CTA |
|---|---|---|---|---|
| Search — no results | Bowl (empty, warm illustration) | "No results for "[query]"" | "We haven't verified a restaurant serving this dish in [city] yet." | "Submit a restaurant" |
| Search — no location | Map pin (amber) | "Where are you looking?" | "Tell us your city to find restaurants near you." | "Set location" |
| Consumer saved dishes — none | Bookmark outline (amber) | "Nothing saved yet" | "When you find dishes you love, save them here." | "Start searching" |
| Admin queue — empty | Checkmark circle (green) | "Queue is clear" | "All submissions have been reviewed." | None |
| Admin queue — filtered empty | Filter icon | "No results for these filters" | "Try adjusting or clearing the filters." | "Clear filters" |
| Restaurant dishes — none added | Fork and knife | "No dishes listed yet" | "Dishes will appear here after the submitter adds them or an admin links them." | None |
| Restaurant photos — none | Camera outline | "No photos yet" | "Photos can be added during submission or by an admin." | None |
| Verification history — empty | Clock | "No history yet" | "Status changes will appear here." | None |

### 15.3 Illustration Style

Empty state illustrations are line-art with amber fills. Not 3D. Not photographic. Consistent stroke weight (2px). Use Lucide icons as the base where possible; expand with custom SVG only when no Lucide equivalent exists. No human characters. No food photography in empty states.

---

## 16. Loading States

### 16.1 Principles

- Show a skeleton where content will appear, not a generic spinner in the center of the page.
- Use a spinner only for actions (button press, form submit) — never for page content.
- Never show a loading state for operations completing in < 200ms. Use a delayed show (200ms delay before skeleton appears).

### 16.2 Skeleton Anatomy

Skeleton elements replace content blocks at their exact dimensions. Color: `neutral-200`. Shimmer animation: diagonal gradient sweep, `1400ms ease-in-out infinite`.

```css
background: linear-gradient(
  90deg,
  neutral-200 0%,
  neutral-100 40%,
  neutral-200 80%
);
background-size: 200% 100%;
animation: shimmer 1.4s ease-in-out infinite;
```

### 16.3 Per-Context Loading States

| Context | Skeleton pattern |
|---|---|
| Restaurant card | Photo block (4:3) + 2 text lines + 1 tag row |
| Admin queue row | Full-width row with 4 text block placeholders |
| Restaurant profile hero | Full-width photo block (16:9) |
| Restaurant name | Single text line, 60% width |
| Dish list | 4 rows of dish-card skeleton |
| Confidence score widget | Score number placeholder + 7 row placeholders |
| Admin event timeline | 4 event row skeletons |
| Search results | 8 card skeletons in grid |

### 16.4 Action Loading States

When a button triggers an async action:
- Replace button label with a 16px spinner (white on brand buttons, amber on ghost buttons)
- Disable the button
- Do not resize the button during loading
- On completion: success state (200ms green transition) or error state (toast)

Maximum spinner duration before a timeout message: 10 seconds. If an action takes longer than 10 seconds, show a "Still working..." message and do not leave the user in silence.

---

## 17. Error States

### 17.1 Error Hierarchy

| Level | Mechanism | Use |
|---|---|---|
| Inline field error | Text below the field, `status-error`, `text-sm` | Form validation errors |
| Inline section error | Error box above the section's CTA, with icon | Multi-field validation failure summary |
| Toast (non-critical) | Bottom-right notification | Background operation failed, user can retry |
| Toast (critical) | Bottom-right notification, persistent | Irreversible action failed |
| Full-page error | Centered layout, full viewport | Route-level error, unrecoverable state |
| Modal error | Error state within existing modal | Action failed within a dialog flow |

### 17.2 Inline Field Error

```
Trigger:    On blur (not on keystroke) for standard inputs. On submit for all fields.
Location:   4px below the input, left-aligned
Icon:       Lucide AlertCircle, 14px, status-error
Text:       text-sm, status-error
```

Field border changes from `neutral-200` to `status-error` (1.5px). Background changes to `status-error-bg`. Never bold the error text — it creates visual panic.

### 17.3 Toast Errors

```
Background:   neutral-0
Border-left:  3px solid status-error
Icon:         Lucide XCircle, 20px, status-error
Title:        text-base font-semibold neutral-900
Body:         text-sm neutral-600 (optional)
Close:        X button, neutral-400
```

Error toasts for admin verification actions (failed approval, failed rejection) must include the specific reason: "Approval failed: confidence score is 0.32. Minimum required is 0.40." — never "Something went wrong."

### 17.4 Full-Page Error

Used for route-level failures (404, 500, auth redirect).

Structure:
1. Icon — Lucide illustration, 64px, `neutral-300`
2. Headline — Fraunces, `text-4xl`, `neutral-900`
3. Body — `text-md`, `neutral-600`, max 2 sentences
4. Primary CTA — "Go home" or context-specific recovery action

| Error | Headline | Body |
|---|---|---|
| 404 | "This page doesn't exist" | "The link may be broken, or the page may have moved." |
| 500 | "Something went wrong" | "We're aware of the problem. Please try again in a moment." |
| 401 | "You need to sign in" | "This page is only available to signed-in users." |
| 403 | "You don't have access" | "This page requires a different permission level." |

### 17.5 Admin-Specific Error Patterns

Admin errors are more informative than consumer errors. They include:

- **Transition errors**: Full message from `ValidationError`. Example: "Cannot approve: this restaurant has no verified dishes."
- **Rate limit**: "Too many requests. Please wait 60 seconds before trying again."
- **Conflict**: Show the conflicting resource (e.g., "A restaurant named [X] already exists in [City]") with a link to the existing record.

---

## 18. Dark Mode Strategy

### Decision: Selective Dark Mode

**Consumer UI:** Light mode only in Phase 1. Dark mode for the consumer experience is a Phase 2+ feature. The photography-forward consumer experience requires careful dark mode implementation that cannot be rushed.

**Admin UI:** Optional dark mode, user-preference controlled. Admin admins work long sessions; dark mode reduces eye strain. Implement alongside the admin UI build (Steps 17–19).

**Decision rationale:**
- A half-implemented dark mode (light mode with a dark header) is worse than no dark mode.
- Consumer dark mode requires re-evaluating all food photography treatments at dark. This is a design-intensive effort that should not block Phase 1 UI.
- Admin dark mode is a simpler surface (no photography, fewer decorative elements) and directly improves the admin team's working experience.

### Admin Dark Mode Token Map

When admin dark mode is active, the following token overrides apply:

| Token (light) | Token (dark admin) |
|---|---|
| `color.bg.base` (`neutral-100`) | `#1A1714` (`neutral-900`) |
| `color.bg.surface` (`neutral-0`) | `#242019` |
| `color.bg.subtle` (`neutral-100`) | `#2C2823` |
| `color.bg.muted` (`neutral-200`) | `#38342E` |
| `color.border.default` (`neutral-200`) | `#38342E` |
| `color.border.strong` (`neutral-300`) | `#4A4640` |
| `color.text.primary` (`neutral-900`) | `#F4F3F0` |
| `color.text.secondary` (`neutral-600`) | `#B0ACA3` |
| `color.text.tertiary` (`neutral-400`) | `#635F57` |
| Sidebar background | `neutral-950` → `#0A0907` |

Brand colors (`amber-500`, `green-500`) remain unchanged in dark mode. They are already warm enough to read against dark backgrounds.

### Implementation

Dark mode is toggled via a `data-theme="dark"` attribute on the `<html>` element (admin layout only). CSS custom properties handle the token overrides. No separate component tree.

```css
:root { --color-bg-base: #F4F3F0; }
[data-theme="dark"] { --color-bg-base: #1A1714; }
```

User preference is stored in `localStorage`. System preference (`prefers-color-scheme: dark`) is used as the default if no stored preference exists — admin only.

---

## Appendix A — Icon System

Use **Lucide React** exclusively. Version must be pinned. No mixing with other icon libraries.

Icon sizes:
- `12px` — inline text icons only
- `16px` — compact UI (admin badge, small button)
- `20px` — standard UI (button with icon, nav item)
- `24px` — feature icons, empty states
- `32px` — large feature icons
- `64px` — full-page error states

Stroke width: `1.5px` for all Lucide icons. Never use `2px` (too heavy in this system).

Icon color: always inherits from `currentColor`. Never hardcode icon colors.

---

## Appendix B — Photography Direction

Photography is a first-class design element on consumer surfaces. These rules govern all food photography in the product.

**What we show:**
- Authentic Nigerian dishes as they appear when served
- Steam, texture, colour — the honest sensory reality of the food
- Real restaurant environments (not studio)

**What we never show:**
- Over-filtered or heavily edited photos (desaturated moody tones do not serve Nigerian food)
- Artificially styled food that misrepresents what a diner will receive
- Stock photography of vaguely African food

**Treatment in product:**
- Photos always `object-cover` — never `object-contain` (no letterboxing)
- No filters or overlays on food photos except a subtle bottom gradient for text legibility on hero images
- Bottom gradient on hero images: `linear-gradient(to top, rgba(26,23,20,0.6) 0%, transparent 60%)`

---

## Appendix C — Tailwind CSS Configuration Reference

This section provides the Tailwind `theme.extend` values that implement the design tokens above. This is a reference only — the design tokens defined in the sections above are authoritative. If the Tailwind config and the design doc conflict, the design doc wins.

```javascript
// tailwind.config.js — theme.extend reference (partial)
colors: {
  amber: {
    50:  '#FFF8ED',
    100: '#FEEBC5',
    200: '#FDD28A',
    300: '#FBB343',
    400: '#F99A18',
    500: '#D4740A',
    600: '#B05E08',
    700: '#8A4906',
    800: '#6B3905',
    900: '#4F2A04',
  },
  green: {
    50:  '#F0F9F3',
    100: '#D1EFD9',
    200: '#A3DFB3',
    300: '#6DC48A',
    400: '#41A863',
    500: '#1B5E3B',
    600: '#164D31',
    700: '#113C26',
    800: '#0C2C1C',
    900: '#071D12',
  },
  neutral: {
    0:   '#FFFFFF',
    50:  '#FAFAF8',
    100: '#F4F3F0',
    200: '#E8E6E1',
    300: '#D2CFC8',
    400: '#B0ACA3',
    500: '#888379',
    600: '#635F57',
    700: '#47443D',
    800: '#302D28',
    900: '#1A1714',
    950: '#100E0B',
  },
},
fontFamily: {
  display: ['Fraunces', 'Georgia', 'serif'],
  sans:    ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  mono:    ['JetBrains Mono', 'Courier New', 'monospace'],
},
borderRadius: {
  none:    '0',
  sm:      '4px',
  DEFAULT: '8px',
  md:      '10px',
  lg:      '12px',
  xl:      '16px',
  '2xl':   '20px',
  '3xl':   '28px',
  full:    '9999px',
},
transitionDuration: {
  instant: '0ms',
  fast:    '100ms',
  normal:  '200ms',
  slow:    '300ms',
  page:    '400ms',
  elaborate: '500ms',
},
transitionTimingFunction: {
  'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
},
```

---

*This document is authoritative. No UI component may be committed without a corresponding spec in this document. Changes require explicit versioning.*
