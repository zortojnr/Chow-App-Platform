import { loadEnvConfig } from '@next/env'
import { PrismaClient } from '@prisma/client'

loadEnvConfig(process.cwd())

const db = new PrismaClient()

const PHOTO_FIXES = [
  {
    slug: 'santorini-abuja',
    url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&h=600&q=80',
  },
  {
    slug: 'the-clubhouse',
    url: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?auto=format&fit=crop&w=800&h=600&q=80',
  },
] as const

async function main() {
  const apply = process.argv.includes('--apply')

  for (const fix of PHOTO_FIXES) {
    const restaurant = await db.restaurant.findUnique({
      where: { slug: fix.slug },
      select: { id: true, name: true },
    })

    if (!restaurant) throw new Error(`Restaurant not found: ${fix.slug}`)

    if (apply) {
      await db.$transaction(async (tx) => {
        await tx.restaurant.update({
          where: { id: restaurant.id },
          data: { thumbnailUrl: fix.url },
        })

        const primaryPhoto = await tx.restaurantPhoto.findFirst({
          where: { restaurantId: restaurant.id, isPrimary: true },
          select: { id: true },
        })

        if (primaryPhoto) {
          await tx.restaurantPhoto.update({
            where: { id: primaryPhoto.id },
            data: { url: fix.url, isVerified: true },
          })
        } else {
          await tx.restaurantPhoto.create({
            data: {
              restaurantId: restaurant.id,
              url: fix.url,
              isPrimary: true,
              isVerified: true,
            },
          })
        }
      })
    }

    console.log(`${apply ? 'Updated' : 'Would update'}: ${restaurant.name}`)
  }

  if (!apply) console.log('Dry run only. Pass --apply to write these two photo records.')
}

main()
  .catch((error) => {
    console.error('Photo repair failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })