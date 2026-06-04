import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { extractIp } from './ip'

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/test', { headers })
}

describe('extractIp', () => {
  it('returns the first IP from x-forwarded-for when multiple are present', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 172.16.0.1' })
    expect(extractIp(req)).toBe('1.2.3.4')
  })

  it('returns the IP when x-forwarded-for has a single value', () => {
    const req = makeRequest({ 'x-forwarded-for': '5.6.7.8' })
    expect(extractIp(req)).toBe('5.6.7.8')
  })

  it('trims whitespace from the IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  9.10.11.12  ' })
    expect(extractIp(req)).toBe('9.10.11.12')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '13.14.15.16' })
    expect(extractIp(req)).toBe('13.14.15.16')
  })

  it('returns 127.0.0.1 when no IP headers are present', () => {
    const req = makeRequest()
    expect(extractIp(req)).toBe('127.0.0.1')
  })

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    })
    expect(extractIp(req)).toBe('1.1.1.1')
  })
})
