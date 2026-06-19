/**
 * seed-restaurant-photos.ts
 *
 * Assigns a cuisine-appropriate thumbnail to every restaurant and syncs it
 * into RestaurantPhoto as the verified primary photo (RestaurantHero/PhotoGallery
 * read from RestaurantPhoto, not thumbnailUrl, so without this row every
 * detail page rendered "Photos coming soon" regardless of the listing thumbnail).
 *
 * Each cuisine bucket holds a pool of curated Unsplash photos. The pool index
 * is derived deterministically from the restaurant id, so re-running this
 * script is stable but restaurants sharing a cuisine no longer all collapse
 * onto a single identical image.
 *
 * Usage:
 *   npx tsx scripts/seed-restaurant-photos.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const BASE = 'https://images.unsplash.com'
const PARAMS = '?auto=format&fit=crop&w=800&h=600&q=80'

function u(id: string) {
  return `${BASE}/photo-${id}${PARAMS}`
}

// Ordered list — first match wins (most specific → most generic). Each rule
// carries a pool of photos; the restaurant id picks a stable index into it.
const CUISINE_PHOTO_RULES: { keywords: string[]; urls: string[] }[] = [
  {
    keywords: ['nigerian', 'african', 'west african', 'yoruba', 'igbo', 'hausa', 'nupe'],
    urls: [
      '1565299624946-b28f40a0ae38', '1604329760661-e71dc83f8f26', '1603496987674-79600a000f55',
      '1665332195309-9d75071138f0', '1661588669110-81142a5b9e57', '1664334997177-6ae654a62735',
      '1665332561290-cc6757172890', '1664992960082-0ea299a9c53e', '1583946193644-49fe1fe958cf',
      '1604329756574-bda1f2cada6f', '1638436684761-7e59f8a9072f', '1664993101841-036f189719b6',
      '1665554837563-3782d21a676b', '1665833613236-7c1d087463b1',
    ].map(u),
  },
  {
    keywords: ['suya', 'grill', 'bbq', 'barbecue', 'steakhouse', 'roast'],
    urls: [
      '1529193591184-b1d58069ecdd', '1555939594-58d7cb561ad1', '1588168333986-5078d3ae3976',
      '1508615263227-c5d58c1e5821', '1558030089-02acba3c214e', '1558030006-450675393462',
      '1627947063935-55577ec3c2e1', '1616252980327-ec70572e5df9', '1558030137-a56c1b004fa3',
    ].map(u),
  },
  {
    keywords: ['seafood', 'fish', 'shrimp', 'prawn', 'lobster', 'crab'],
    urls: [
      '1484723091739-30990d29dbd4', '1606850780554-b55ea4dd0b70', '1651323018466-b36b7df1d2b1',
      '1618055301293-494ab4c71f9f', '1595579547936-c3a0e6c171fc', '1557267725-c530b236f446',
      '1636797600090-146b191714cb', '1519351635902-7c60d09cb2ed',
    ].map(u),
  },
  {
    keywords: ['shawarma', 'kebab', 'wrap', 'lebanese', 'middle eastern', 'turkish', 'arabic'],
    urls: [
      '1544025162-d76538840979', '1662116765994-1e4200c43589', '1719282431565-3b30bb7d2658',
      '1530469912745-a215c6b256ea', '1699728088614-7d1d4277414b', '1676300187013-7540d4e9440d',
      '1583060095186-852adde6b819',
    ].map(u),
  },
  {
    keywords: ['mediterranean', 'greek', 'moroccan'],
    urls: [
      '1544025162-d76538840979', '1662116765994-1e4200c43589', '1719282431565-3b30bb7d2658',
      '1530469912745-a215c6b256ea',
    ].map(u),
  },
  {
    keywords: ['indian', 'south asian', 'curry', 'biryani', 'tandoor'],
    urls: [
      '1585937421612-70a008356fbe', '1728910156510-77488f19b152', '1565557623262-b51c2513a641',
      '1596797038530-2c107229654b', '1603894584373-5ac82b2ae398', '1631452180539-96aca7d48617',
      '1606471191009-63994c53433b',
    ].map(u),
  },
  {
    keywords: ['chinese', 'pan-asian', 'dim sum', 'cantonese', 'szechuan', 'mandarin'],
    urls: [
      '1563245372-f21724e3856d', '1585032226651-759b368d7246', '1569718212165-3a8278d5f624',
      '1623689048105-a17b1e1936b8', '1496116218417-1a781b1c416c', '1555126634-323283e090fa',
      '1635685296916-95acaf58471f',
    ].map(u),
  },
  {
    keywords: ['japanese', 'sushi', 'ramen', 'teppanyaki', 'tempura'],
    urls: [
      '1553621042-f6e147245754', '1579584425555-c3ce17fd4351', '1579871494447-9811cf80d66c',
      '1611143669185-af224c5e3252', '1617196034796-73dfa7b1fd56', '1563612116625-3012372fccce',
    ].map(u),
  },
  {
    keywords: ['thai', 'vietnamese', 'korean', 'asian'],
    urls: [
      '1563245372-f21724e3856d', '1585032226651-759b368d7246', '1569718212165-3a8278d5f624',
      '1623689048105-a17b1e1936b8',
    ].map(u),
  },
  {
    keywords: ['italian', 'pasta', 'pizza', 'trattoria'],
    urls: [
      '1565299507177-b0ac66763828', '1556761223-4c4282c73f77', '1546549032-9571cd6b27df',
      '1516100882582-96c3a05fe590', '1600803907087-f56d462fd26b', '1498579150354-977475b7ea0b',
    ].map(u),
  },
  {
    keywords: ['french', 'european', 'continental', 'intercontinental', 'fine dining', 'bistro'],
    urls: [
      '1414235077428-338989a2e8c0', '1663530761401-15eefb544889', '1467003909585-2f8a72700288',
      '1611520175743-30ff00129621', '1643879397174-4f10ac503566',
    ].map(u),
  },
  {
    keywords: ['fast food', 'burger', 'american', 'wings', 'fried chicken'],
    urls: [
      '1568901346375-23c9450c58cd', '1561758033-d89a9ad46330', '1594212699903-ec8a3eca50f5',
      '1551782450-a2132b4ba21d', '1518013431117-eb1465fa5752', '1598679253544-2c97992403ea',
    ].map(u),
  },
  {
    keywords: ['cafe', 'coffee', 'espresso', 'brunch'],
    urls: [
      '1495474472287-4d71bcdd2085', '1509042239860-f550ce710b93', '1447933601403-0c6688de566e',
      '1511920170033-f8396924c348', '1542372147193-a7aca54189cd', '1453614512568-c4024d13c247',
    ].map(u),
  },
  {
    keywords: ['bakery', 'pastry', 'bread', 'cake'],
    urls: [
      '1509440159596-0249088772ff', '1608198093002-ad4e005484ec', '1568254183919-78a4f43a2877',
      '1587241321921-91a834d6d191', '1483695028939-5bb13f8648b0', '1534432182912-63863115e106',
    ].map(u),
  },
  {
    keywords: ['bar', 'lounge', 'cocktail', 'nightclub', 'club'],
    urls: [
      '1568702846914-96b305d2aaeb', '1597241693839-07d7fb803af1', '1566417713940-fe7c737a9ef2',
      '1485872299829-c673f5194813', '1470337458703-46ad1756a187', '1572116469696-31de0f17cc34',
    ].map(u),
  },
  {
    keywords: ['vegetarian', 'vegan', 'healthy', 'salad'],
    urls: [
      '1512621776951-a57141f2eefd', '1540420773420-3366772f4999', '1546069901-ba9599a7e63c',
      '1568158879083-c42860933ed7', '1543339308-43e59d6b73a6', '1505576633757-0ac1084af824',
    ].map(u),
  },
]

const DEFAULT_POOL = CUISINE_PHOTO_RULES[0].urls

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Stable hash of the restaurant id → deterministic pool index
function hashIndex(id: string, poolSize: number): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash % poolSize
}

function pickPhoto(id: string, cuisineTypes: string[]): string {
  const joined = normalize(cuisineTypes.join(' '))
  const pool = CUISINE_PHOTO_RULES.find((rule) =>
    rule.keywords.some((kw) => joined.includes(normalize(kw))),
  )?.urls ?? DEFAULT_POOL

  return pool[hashIndex(id, pool.length)]
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) console.log('\n🔍  Mode : dry-run — nothing will be written\n')
  else          console.log('\n⚡  Mode : LIVE — writing to database\n')

  const restaurants = await db.restaurant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, cuisineTypes: true },
    orderBy: { name: 'asc' },
  })

  console.log(`Found ${restaurants.length} restaurants.\n`)

  let updated = 0

  for (const r of restaurants) {
    const url = pickPhoto(r.id, r.cuisineTypes)
    const cuisineLabel = r.cuisineTypes.join(', ') || '—'
    console.log(`  ${isDryRun ? '[DRY] ' : ''}${r.name} (${cuisineLabel}) → ${url.slice(BASE.length + 7, BASE.length + 17)}…`)

    if (!isDryRun) {
      await db.restaurant.update({
        where: { id: r.id },
        data:  { thumbnailUrl: url },
      })

      // Sync the primary RestaurantPhoto so RestaurantHero/PhotoGallery
      // (which read photos, not thumbnailUrl) render the same image.
      const existingPrimary = await db.restaurantPhoto.findFirst({
        where: { restaurantId: r.id, isPrimary: true },
      })

      if (existingPrimary) {
        await db.restaurantPhoto.update({
          where: { id: existingPrimary.id },
          data:  { url, isVerified: true },
        })
      } else {
        await db.restaurantPhoto.create({
          data: {
            restaurantId: r.id,
            url,
            isPrimary:  true,
            isVerified: true,
          },
        })
      }
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
