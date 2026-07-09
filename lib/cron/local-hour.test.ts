import { describe, expect, it } from 'vitest'
import { currentHourInZone, dueAtLocalHour } from './local-hour'

// Fixed instant, no DST edge: 2026-01-15T12:00:00Z.
// UTC 12h · America/Sao_Paulo (UTC-3) 9h · Asia/Tokyo (UTC+9) 21h ·
// America/New_York (EST, UTC-5) 7h.
const NOW = new Date('2026-01-15T12:00:00Z')

describe('currentHourInZone', () => {
  it('returns the wall-clock hour of the zone, not UTC', () => {
    expect(currentHourInZone('UTC', NOW)).toBe(12)
    expect(currentHourInZone('America/Sao_Paulo', NOW)).toBe(9)
    expect(currentHourInZone('Asia/Tokyo', NOW)).toBe(21)
    expect(currentHourInZone('America/New_York', NOW)).toBe(7)
  })

  it('tracks DST: New York is UTC-4 in July', () => {
    expect(currentHourInZone('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(8)
  })
})

describe('dueAtLocalHour', () => {
  const targets = [
    { tenant: 'utc-noon', timeZone: 'UTC',               sendHourLocal: 12 },
    { tenant: 'sp-nine',  timeZone: 'America/Sao_Paulo', sendHourLocal: 9 },
    { tenant: 'sp-eight', timeZone: 'America/Sao_Paulo', sendHourLocal: 8 },
    { tenant: 'tokyo-21', timeZone: 'Asia/Tokyo',        sendHourLocal: 21 },
    { tenant: 'ny-noon',  timeZone: 'America/New_York',  sendHourLocal: 12 },
  ]

  it('selects exactly the tenants whose OWN local hour matches right now', () => {
    expect(dueAtLocalHour(targets, NOW)).toEqual(['utc-noon', 'sp-nine', 'tokyo-21'])
  })

  it('one hourly sweep hits every tenant exactly once per day, each at its own hour', () => {
    const hits: string[] = []
    for (let h = 0; h < 24; h++) {
      hits.push(...dueAtLocalHour(targets, new Date(Date.UTC(2026, 0, 15, h))))
    }
    expect(hits.sort()).toEqual(['ny-noon', 'sp-eight', 'sp-nine', 'tokyo-21', 'utc-noon'])
  })

  it('normalizes hour 24 onto the 0–23 ring', () => {
    const t = [{ tenant: 'x', timeZone: 'UTC', sendHourLocal: 24 }]
    expect(dueAtLocalHour(t, new Date('2026-01-15T00:30:00Z'))).toEqual(['x'])
  })

  it('treats an invalid IANA zone as UTC (partsInZone fallback) instead of throwing', () => {
    const t = [{ tenant: 'bad', timeZone: 'Not/AZone', sendHourLocal: 12 }]
    expect(dueAtLocalHour(t, NOW)).toEqual(['bad'])
  })
})
