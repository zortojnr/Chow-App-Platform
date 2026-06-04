import { describe, it, expect } from 'vitest'
import { VerificationStatus } from '@prisma/client'
import { QueueQuerySchema } from './queue.schema'

describe('QueueQuerySchema', () => {
  it('accepts all defaults when no params are provided', () => {
    const r = QueueQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    expect(r.data?.status).toBe(VerificationStatus.PENDING_REVIEW)
    expect(r.data?.sort).toBe('oldest')
    expect(r.data?.page).toBe(1)
    expect(r.data?.limit).toBe(20)
  })

  it('accepts a valid full query', () => {
    const r = QueueQuerySchema.safeParse({
      status: 'NEEDS_INFO',
      city: 'Lagos',
      assignedTo: 'me',
      sort: 'newest',
      page: '2',
      limit: '50',
    })
    expect(r.success).toBe(true)
    expect(r.data?.status).toBe(VerificationStatus.NEEDS_INFO)
    expect(r.data?.city).toBe('Lagos')
    expect(r.data?.sort).toBe('newest')
    expect(r.data?.page).toBe(2)
    expect(r.data?.limit).toBe(50)
  })

  it('coerces page and limit from strings to numbers', () => {
    const r = QueueQuerySchema.safeParse({ page: '3', limit: '10' })
    expect(r.data?.page).toBe(3)
    expect(r.data?.limit).toBe(10)
  })

  it('rejects page < 1', () => {
    expect(QueueQuerySchema.safeParse({ page: '0' }).success).toBe(false)
  })

  it('rejects limit > 100', () => {
    expect(QueueQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
  })

  it('accepts limit at exactly 100', () => {
    expect(QueueQuerySchema.safeParse({ limit: '100' }).success).toBe(true)
  })

  it('rejects an invalid VerificationStatus value', () => {
    expect(QueueQuerySchema.safeParse({ status: 'INVALID_STATUS' }).success).toBe(false)
  })

  it('accepts all valid VerificationStatus values', () => {
    for (const s of Object.values(VerificationStatus)) {
      expect(QueueQuerySchema.safeParse({ status: s }).success).toBe(true)
    }
  })

  it('rejects an invalid sort value', () => {
    expect(QueueQuerySchema.safeParse({ sort: 'random' }).success).toBe(false)
  })

  it('accepts assignedTo as "me"', () => {
    expect(QueueQuerySchema.safeParse({ assignedTo: 'me' }).success).toBe(true)
  })

  it('accepts assignedTo as "unassigned"', () => {
    expect(QueueQuerySchema.safeParse({ assignedTo: 'unassigned' }).success).toBe(true)
  })

  it('accepts assignedTo as a UUID', () => {
    const r = QueueQuerySchema.safeParse({ assignedTo: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' })
    expect(r.success).toBe(true)
  })

  it('rejects assignedTo as an arbitrary non-UUID string', () => {
    expect(QueueQuerySchema.safeParse({ assignedTo: 'not-a-uuid-or-keyword' }).success).toBe(false)
  })

  it('trims whitespace from city', () => {
    const r = QueueQuerySchema.safeParse({ city: '  Abuja  ' })
    expect(r.data?.city).toBe('Abuja')
  })

  it('rejects city as an empty string', () => {
    expect(QueueQuerySchema.safeParse({ city: '' }).success).toBe(false)
  })
})
