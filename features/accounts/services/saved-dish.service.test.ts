// Saved Dish Service — unit tests
//
// All DB calls are mocked. Covers: save (create + idempotent conflict),
// unsave (ownership enforcement, not-found), list (pagination, city filter,
// dedup shape), and the idsOnly hydration query.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { SavedDishService } from './saved-dish.service'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

vi.mock('@/lib/db', () => ({
  db: {
    savedDish: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
const mockDb = db as any

const USER_ID = 'user-uuid-001'
const OTHER_USER_ID = 'user-uuid-002'
const RESTAURANT_DISH_ID = 'rd-uuid-001'
const SAVED_DISH_ID = 'saved-uuid-001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SavedDishService.saveDish', () => {
  it('creates a new SavedDish row', async () => {
    mockDb.savedDish.create.mockResolvedValue({ id: SAVED_DISH_ID })

    const result = await SavedDishService.saveDish(USER_ID, RESTAURANT_DISH_ID)

    expect(result).toEqual({ id: SAVED_DISH_ID })
    expect(mockDb.savedDish.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, restaurantDishId: RESTAURANT_DISH_ID },
      select: { id: true },
    })
  })

  it('is idempotent on a unique-constraint conflict — returns the existing row', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    })
    mockDb.savedDish.create.mockRejectedValue(conflict)
    mockDb.savedDish.findFirst.mockResolvedValue({ id: SAVED_DISH_ID })

    const result = await SavedDishService.saveDish(USER_ID, RESTAURANT_DISH_ID)

    expect(result).toEqual({ id: SAVED_DISH_ID })
  })

  it('rethrows non-conflict errors', async () => {
    mockDb.savedDish.create.mockRejectedValue(new Error('connection lost'))

    await expect(SavedDishService.saveDish(USER_ID, RESTAURANT_DISH_ID)).rejects.toThrow('connection lost')
  })
})

describe('SavedDishService.unsaveDish', () => {
  it('deletes when the caller owns the SavedDish', async () => {
    mockDb.savedDish.findFirst.mockResolvedValue({ userId: USER_ID })
    mockDb.savedDish.delete.mockResolvedValue({})

    await SavedDishService.unsaveDish(USER_ID, SAVED_DISH_ID)

    expect(mockDb.savedDish.delete).toHaveBeenCalledWith({ where: { id: SAVED_DISH_ID } })
  })

  it('throws ForbiddenError when the SavedDish belongs to another user', async () => {
    mockDb.savedDish.findFirst.mockResolvedValue({ userId: OTHER_USER_ID })

    await expect(SavedDishService.unsaveDish(USER_ID, SAVED_DISH_ID)).rejects.toThrow(ForbiddenError)
    expect(mockDb.savedDish.delete).not.toHaveBeenCalled()
  })

  it('throws NotFoundError when the SavedDish does not exist', async () => {
    mockDb.savedDish.findFirst.mockResolvedValue(null)

    await expect(SavedDishService.unsaveDish(USER_ID, SAVED_DISH_ID)).rejects.toThrow(NotFoundError)
  })
})

describe('SavedDishService.listSavedDishes', () => {
  const MOCK_ROW = {
    id: SAVED_DISH_ID,
    restaurantDishId: RESTAURANT_DISH_ID,
    notes: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    restaurantDish: {
      nameAsServed: 'Jollof Rice Special',
      price: { toString: () => '2500' },
      restaurant: { id: 'r1', name: 'Mama Titi', slug: 'mama-titi', city: 'Abuja', area: 'Wuse 2', thumbnailUrl: null },
      dish: { canonicalName: 'Jollof Rice' },
    },
  }

  it('maps rows to the list item shape and computes pagination', async () => {
    mockDb.savedDish.findMany.mockResolvedValue([MOCK_ROW])
    mockDb.savedDish.count.mockResolvedValue(1)

    const result = await SavedDishService.listSavedDishes(USER_ID, { page: 1, limit: 20 })

    expect(result.items).toEqual([
      {
        id: SAVED_DISH_ID,
        restaurantDishId: RESTAURANT_DISH_ID,
        notes: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        restaurant: MOCK_ROW.restaurantDish.restaurant,
        dish: { canonicalName: 'Jollof Rice', nameAsServed: 'Jollof Rice Special', price: '2500' },
      },
    ])
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('caps limit at 20 even if a larger value is requested', async () => {
    mockDb.savedDish.findMany.mockResolvedValue([])
    mockDb.savedDish.count.mockResolvedValue(0)

    await SavedDishService.listSavedDishes(USER_ID, { page: 1, limit: 50 })

    expect(mockDb.savedDish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    )
  })

  it('filters by city when provided', async () => {
    mockDb.savedDish.findMany.mockResolvedValue([])
    mockDb.savedDish.count.mockResolvedValue(0)

    await SavedDishService.listSavedDishes(USER_ID, { page: 1, limit: 20, city: 'Lagos' })

    expect(mockDb.savedDish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, restaurantDish: { restaurant: { city: 'Lagos' } } },
      }),
    )
  })
})

describe('SavedDishService.listSavedDishIds', () => {
  it('returns both the restaurantDishId and the SavedDish id for each row', async () => {
    mockDb.savedDish.findMany.mockResolvedValue([
      { id: 'saved-a', restaurantDishId: 'a' },
      { id: 'saved-b', restaurantDishId: 'b' },
    ])

    const result = await SavedDishService.listSavedDishIds(USER_ID)

    expect(result).toEqual([
      { restaurantDishId: 'a', savedDishId: 'saved-a' },
      { restaurantDishId: 'b', savedDishId: 'saved-b' },
    ])
  })
})
