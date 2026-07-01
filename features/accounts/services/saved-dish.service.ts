// Saved Dish Service — Track 5 §5.1
//
// Implements the SavedDish CRUD contract Track 4 §7.4 already promised the
// frontend. Ownership rule (security-standards.md §3.3): every mutation and
// the list query are scoped to session.user.id, taken from the caller — never
// from a client-supplied id.
//
// Governed by: track-05-user-accounts.md §5, §8.3

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

export type SavedDishListItem = {
  id: string
  restaurantDishId: string
  notes: string | null
  createdAt: string
  restaurant: {
    id: string
    name: string
    slug: string
    city: string
    area: string | null
    thumbnailUrl: string | null
  }
  dish: {
    canonicalName: string
    nameAsServed: string | null
    price: string | null
  }
}

export type SavedDishListResponse = {
  items: SavedDishListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const P2002_UNIQUE_CONSTRAINT = 'P2002'

export const SavedDishService = {
  /**
   * Saves a dish for a user. Idempotent: if the (userId, restaurantDishId) pair
   * already exists, returns the existing row instead of throwing — Track 4 §7.3
   * treats a 409 as a success in the UI, so the service absorbs the conflict here.
   */
  async saveDish(userId: string, restaurantDishId: string): Promise<{ id: string }> {
    try {
      const created = await db.savedDish.create({
        data: { userId, restaurantDishId },
        select: { id: true },
      })
      return created
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === P2002_UNIQUE_CONSTRAINT) {
        const existing = await db.savedDish.findFirst({
          where: { userId, restaurantDishId },
          select: { id: true },
        })
        if (existing) return existing
      }
      throw error
    }
  },

  /**
   * Unsaves a dish. Throws ForbiddenError if the SavedDish does not belong to
   * the caller — this is the ownership check required by security-standards.md §3.3.
   */
  async unsaveDish(userId: string, savedDishId: string): Promise<void> {
    const savedDish = await db.savedDish.findFirst({
      where: { id: savedDishId },
      select: { userId: true },
    })
    if (!savedDish) throw new NotFoundError('Saved dish')
    if (savedDish.userId !== userId) throw new ForbiddenError()

    await db.savedDish.delete({ where: { id: savedDishId } })
  },

  /**
   * Lists a user's saved dishes with restaurant and dish context, paginated.
   * `city` optionally narrows to restaurants in that city.
   */
  async listSavedDishes(
    userId: string,
    { page = 1, limit = 20, city }: { page?: number; limit?: number; city?: string },
  ): Promise<SavedDishListResponse> {
    const cappedLimit = Math.min(limit, 20)
    const where: Prisma.SavedDishWhereInput = {
      userId,
      ...(city ? { restaurantDish: { restaurant: { city } } } : {}),
    }

    const [rows, total] = await Promise.all([
      db.savedDish.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        select: {
          id: true,
          restaurantDishId: true,
          notes: true,
          createdAt: true,
          restaurantDish: {
            select: {
              nameAsServed: true,
              price: true,
              restaurant: {
                select: { id: true, name: true, slug: true, city: true, area: true, thumbnailUrl: true },
              },
              dish: { select: { canonicalName: true } },
            },
          },
        },
      }),
      db.savedDish.count({ where }),
    ])

    const items: SavedDishListItem[] = rows.map((row) => ({
      id: row.id,
      restaurantDishId: row.restaurantDishId,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      restaurant: row.restaurantDish.restaurant,
      dish: {
        canonicalName: row.restaurantDish.dish.canonicalName,
        nameAsServed: row.restaurantDish.nameAsServed,
        price: row.restaurantDish.price?.toString() ?? null,
      },
    }))

    return { items, total, page, limit: cappedLimit, totalPages: Math.ceil(total / cappedLimit) }
  },

  /**
   * IDs only — used to hydrate the Zustand saved-dishes store on session start
   * (Track 4 §7.5). Returns both ids because the store needs restaurantDishId
   * to answer "is this saved?" and SavedDish.id to call DELETE later.
   */
  async listSavedDishIds(userId: string): Promise<{ restaurantDishId: string; savedDishId: string }[]> {
    const rows = await db.savedDish.findMany({
      where: { userId },
      select: { id: true, restaurantDishId: true },
    })
    return rows.map((r) => ({ restaurantDishId: r.restaurantDishId, savedDishId: r.id }))
  },
}
