/**
 * seed-restaurant-photos.ts
 *
 * Assigns a cuisine-appropriate thumbnail photo to every restaurant that
 * currently has thumbnailUrl = null.  Photos are sourced from Unsplash's
 * CDN using curated, stable photo IDs matched to each restaurant's
 * cuisineTypes array.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-restaurant-photos.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const BASE = 'https://images.unsplash.com'
const PARAMS = '?auto=format&fit=crop&w=800&h=600&q=80'

function u(id: string) {
  return `${BASE}/photo-${id}${PARAMS}`
}

// Ordered list — first match wins (most specific → most generic)
const CUISINE_PHOTO_RULES: { keywords: string[]; url: string }[] = [
  {
    keywords: ['nigerian', 'african', 'west african', 'yoruba', 'igbo', 'hausa', 'nupe'],
    url: u('1565299624946-b28f40a0ae38'),
  },
  {
    keywords: ['suya', 'grill', 'bbq', 'barbecue', 'steakhouse', 'roast'],
    url: u('1529193591184-b1d58069ecdd'),
  },
  {
    keywords: ['seafood', 'fish', 'shrimp', 'prawn', 'lobster', 'crab'],
    url: u('1484723091739-30990d29dbd4'),
  },
  {
    keywords: ['shawarma', 'kebab', 'wrap', 'lebanese', 'middle eastern', 'turkish', 'arabic'],
    url: u('1544025162-d76538840979'),
  },
  {
    keywords: ['mediterranean', 'greek', 'moroccan'],
    url: u('1544025162-d76538840979'),
  },
  {
    keywords: ['indian', 'south asian', 'curry', 'biryani', 'tandoor'],
    url: u('1585937421612-70a008356fbe'),
  },
  {
    keywords: ['chinese', 'pan-asian', 'dim sum', 'cantonese', 'szechuan', 'mandarin'],
    url: u('1563245372-f21724e3856d'),
  },
  {
    keywords: ['japanese', 'sushi', 'ramen', 'teppanyaki', 'tempura'],
    url: u('1553621042-f6e147245754'),
  },
  {
    keywords: ['thai', 'vietnamese', 'korean', 'asian'],
    url: u('1563245372-f21724e3856d'),
  },
  {
    keywords: ['italian', 'pasta', 'pizza', 'trattoria'],
    url: u('1565299507177-b0ac66763828'),
  },
  {
    keywords: ['french', 'european', 'continental', 'intercontinental', 'fine dining', 'bistro'],
    url: u('1414235077428-338989a2e8c0'),
  },
  {
    keywords: ['fast food', 'burger', 'american', 'wings', 'fried chicken'],
    url: u('1568901346375-23c9450c58cd'),
  },
  {
    keywords: ['cafe', 'coffee', 'espresso', 'brunch'],
    url: u('1495474472287-4d71bcdd2085'),
  },
  {
    keywords: ['bakery', 'pastry', 'bread', 'cake'],
    url: u('1509440159596-0249088772ff'),
  },
  {
    keywords: ['bar', 'lounge', 'cocktail', 'nightclub', 'club'],
    url: u('1568702846914-96b305d2aaeb'),
  },
  {
    keywords: ['vegetarian', 'vegan', 'healthy', 'salad'],
    url: u('1512621776951-a57141f2eefd'),
  },
]

const DEFAULT_URL = u('1565299624946-b28f40a0ae38')

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function pickPhoto(cuisineTypes: string[]): string {
  const joined = normalize(cuisineTypes.join(' '))
  for (const rule of CUISINE_PHOTO_RULES) {
    if (rule.keywords.some((kw) => joined.includes(normalize(kw)))) {
      return rule.url
    }
  }
  return DEFAULT_URL
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) console.log('\n🔍  Mode : dry-run — nothing will be written\n')
  else          console.log('\n⚡  Mode : LIVE — writing to database\n')

  const restaurants = await db.restaurant.findMany({
    where: { thumbnailUrl: null },
    select: { id: true, name: true, cuisineTypes: true },
    orderBy: { name: 'asc' },
  })

  console.log(`Found ${restaurants.length} restaurants with no photo.\n`)

  if (restaurants.length === 0) {
    console.log('Nothing to update.')
    await db.$disconnect()
    return
  }

  let updated = 0

  for (const r of restaurants) {
    const url = pickPhoto(r.cuisineTypes)
    const cuisineLabel = r.cuisineTypes.join(', ') || '—'
    console.log(`  ${isDryRun ? '[DRY] ' : ''}${r.name} (${cuisineLabel}) → ${url.slice(BASE.length + 7, BASE.length + 17)}…`)

    if (!isDryRun) {
      await db.restaurant.update({
        where: { id: r.id },
        data:  { thumbnailUrl: url },
      })
    }
    updated++
  }

  console.log(`\n─────────────────────────────`)
  console.log(`✅  ${isDryRun ? 'Would update' : 'Updated'} : ${updated}`)
  console.log(`─────────────────────────────\n`)

  if (isDryRun) console.log('Dry-run complete. Run without --dry-run to apply.')

  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
