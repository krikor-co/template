import { describe, expect, it } from 'vitest'
import { partsInZone, zonedWallTimeToUtc } from './zoned'

describe('partsInZone', () => {
  it('decomposes a UTC instant into wall-clock parts of the zone', () => {
    // 2026-01-15T03:00:00Z is 2026-01-15 00:00:00 in São Paulo (UTC-3, no DST).
    const p = partsInZone(new Date('2026-01-15T03:00:00Z'), 'America/Sao_Paulo')
    expect(p.year).toBe(2026)
    expect(p.month).toBe(1)
    expect(p.day).toBe(15)
    expect(p.minute).toBe(0)
    expect(p.second).toBe(0)
    expect(p.dateStr).toBe('2026-01-15')
    expect(p.weekday).toBe(4) // Thursday
  })

  it('normalizes the hour-24 engine quirk: local midnight is hour 0, not 24', () => {
    const p = partsInZone(new Date('2026-01-15T03:00:00Z'), 'America/Sao_Paulo')
    expect(p.hour).toBe(0)
  })

  it('maps Sunday to ISO weekday 7', () => {
    // 2026-01-18 is a Sunday.
    expect(partsInZone(new Date('2026-01-18T12:00:00Z'), 'UTC').weekday).toBe(7)
  })

  it('renders both sides of a fall-back transition correctly', () => {
    // America/New_York falls back 2026-11-01: 02:00 EDT → 01:00 EST.
    // 05:30Z is 01:30 EDT; 06:30Z is 01:30 EST — same wall clock twice.
    expect(partsInZone(new Date('2026-11-01T05:30:00Z'), 'America/New_York').hour).toBe(1)
    expect(partsInZone(new Date('2026-11-01T06:30:00Z'), 'America/New_York').hour).toBe(1)
  })

  it('skips the spring-forward gap hour', () => {
    // America/New_York springs forward 2026-03-08: 02:00 EST → 03:00 EDT (07:00Z).
    expect(partsInZone(new Date('2026-03-08T06:59:00Z'), 'America/New_York').hour).toBe(1)
    expect(partsInZone(new Date('2026-03-08T07:00:00Z'), 'America/New_York').hour).toBe(3)
  })

  it('falls back to UTC parts on an invalid IANA zone instead of throwing', () => {
    const p = partsInZone(new Date('2026-01-15T12:34:56Z'), 'Not/AZone')
    expect(p.hour).toBe(12)
    expect(p.dateStr).toBe('2026-01-15')
  })
})

describe('zonedWallTimeToUtc', () => {
  it('converts winter wall time (EST, UTC-5)', () => {
    expect(zonedWallTimeToUtc(2026, 1, 15, 12, 0, 'America/New_York').toISOString())
      .toBe('2026-01-15T17:00:00.000Z')
  })

  it('converts summer wall time (EDT, UTC-4)', () => {
    expect(zonedWallTimeToUtc(2026, 7, 15, 12, 0, 'America/New_York').toISOString())
      .toBe('2026-07-15T16:00:00.000Z')
  })

  it('resolves times inside the spring-forward gap to the post-transition offset', () => {
    // 02:30 on 2026-03-08 does not exist in America/New_York.
    expect(zonedWallTimeToUtc(2026, 3, 8, 2, 30, 'America/New_York').toISOString())
      .toBe('2026-03-08T06:30:00.000Z')
  })

  it('resolves ambiguous fall-back times to the first (pre-transition) occurrence', () => {
    // 01:30 on 2026-11-01 occurs twice in America/New_York; expect the EDT one.
    expect(zonedWallTimeToUtc(2026, 11, 1, 1, 30, 'America/New_York').toISOString())
      .toBe('2026-11-01T05:30:00.000Z')
  })

  it('round-trips with partsInZone for a normal instant', () => {
    const utc = zonedWallTimeToUtc(2026, 1, 15, 0, 0, 'America/Sao_Paulo')
    expect(utc.toISOString()).toBe('2026-01-15T03:00:00.000Z')
    const p = partsInZone(utc, 'America/Sao_Paulo')
    expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 1, 15, 0, 0])
  })
})
