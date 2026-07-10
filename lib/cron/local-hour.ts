import { partsInZone } from '@/lib/time/zoned'

/**
 * Per-tenant local-hour fan-out for HOURLY crons (see docs/cron.md).
 *
 * Pattern (extracted from a production hourly-digest cron): schedule ONE cron
 * every hour ("0 * * * *"); on each run, fan out only to the tenants whose
 * OWN wall clock currently reads their configured send hour. Every tenant
 * gets its job at its own local time (08:00 in São Paulo AND 08:00 in Tokyo)
 * from a single schedule — no per-tenant cron entries, DST handled by the
 * IANA zone database.
 */

export type LocalHourTarget<T> = {
  tenant: T
  /** IANA timezone (e.g. 'America/Sao_Paulo'). Invalid zones fall back to
   *  UTC — inherited from partsInZone (lib/time/zoned.ts). */
  timeZone: string
  /** Local wall-clock hour (0–23) the tenant's job should fire at. Values
   *  outside the range wrap onto the 0–23 ring (24 → 0). */
  sendHourLocal: number
}

/** Current hour (0–23) on the tenant's own wall clock. */
export function currentHourInZone(timeZone: string, now: Date = new Date()): number {
  return partsInZone(now, timeZone).hour
}

/** The tenants due RIGHT NOW: their own local hour equals their send hour. */
export function dueAtLocalHour<T>(
  targets: ReadonlyArray<LocalHourTarget<T>>,
  now: Date = new Date(),
): T[] {
  return targets
    .filter((t) => currentHourInZone(t.timeZone, now) === normalizeHour(t.sendHourLocal))
    .map((t) => t.tenant)
}

/** Clamp any integer onto the 0–23 ring (24 → 0, -1 → 23). */
function normalizeHour(hour: number): number {
  return ((Math.trunc(hour) % 24) + 24) % 24
}
