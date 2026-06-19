/**
 * audit-restaurant-images.ts — one-off audit, not part of the app.
 *
 * Reports how restaurant thumbnails / gallery photos are currently
 * associated, so we know whether images are restaurant-specific or
 * generic stock shared across many restaurants.
 *
 * Usage: npx tsx scripts/audit-restaurant-images.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const total = await db.restaurant.count({ where: { deletedAt: null } })
  const noThumbnail = await db.restaurant.count({ where: { deletedAt: null, thumbnailUrl: null } })

  const restaurants = await db.restaurant.findMany({
    where: { deletedAt: null, thumbnailUrl: { not: null } },
    select: { id: true, name: true, thumbnailUrl: true },
  })

  const byHost: Record<string, number> = {}
  const byUrl: Record<string, string[]> = {}
  for (const r of restaurants) {
    const url = r.thumbnailUrl!
    const host = new URL(url).hostname
    byHost[host] = (byHost[host] ?? 0) + 1
    byUrl[url] = byUrl[url] ?? []
    byUrl[url].push(r.name)
  }

  const sharedUrls = Object.entries(byUrl)
    .filter(([, names]) => names.length > 1)
    .sort((a, b) => b[1].length - a[1].length)

  const photoCount = await db.restaurantPhoto.count()
  const verifiedPhotoCount = await db.restaurantPhoto.count({ where: { isVerified: true } })
  const primaryPhotoCount = await db.restaurantPhoto.count({ where: { isPrimary: true } })
  const restaurantsWithAnyPhoto = await db.restaurantPhoto.groupBy({ by: ['restaurantId'] })
  const restaurantsWithVerifiedPhoto = await db.restaurantPhoto.groupBy({
    by: ['restaurantId'],
    where: { isVerified: true },
  })

  console.log('─── Restaurant count ───')
  console.log(`Total active restaurants:        ${total}`)
  console.log(`Restaurants with no thumbnail:    ${noThumbnail}`)
  console.log()

  console.log('─── Thumbnail host distribution ───')
  for (const [host, count] of Object.entries(byHost)) {
    console.log(`  ${host.padEnd(28)} ${count}`)
  }
  console.log()

  console.log(`─── Thumbnail URLs reused across multiple restaurants ───`)
  console.log(`${sharedUrls.length} distinct URLs are shared by 2+ restaurants`)
  for (const [url, names] of sharedUrls.slice(0, 10)) {
    console.log(`  [${names.length}x] ${url}`)
    console.log(`        e.g. ${names.slice(0, 4).join(' | ')}`)
  }
  console.log()

  console.log('─── RestaurantPhoto (gallery) table ───')
  console.log(`Total photo rows:                      ${photoCount}`)
  console.log(`Verified photo rows:                    ${verifiedPhotoCount}`)
  console.log(`Primary photo rows:                     ${primaryPhotoCount}`)
  console.log(`Distinct restaurants with ANY photo:    ${restaurantsWithAnyPhoto.length}`)
  console.log(`Distinct restaurants with VERIFIED photo: ${restaurantsWithVerifiedPhoto.length}`)
  console.log(`Distinct restaurants with NO photo row:   ${total - restaurantsWithAnyPhoto.length}`)

  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
