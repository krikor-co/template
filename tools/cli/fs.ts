import * as fs from 'fs'
import * as path from 'path'

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  if (fs.existsSync(filePath)) {
    console.error(`  SKIP  ${filePath} (already exists)`)
    return
  }

  fs.writeFileSync(filePath, content)
  console.log(`  CREATE  ${filePath}`)
}

/**
 * Derive a PascalCase component name from a path.
 * "app/bookings/list/_components/BookingsList" → "BookingsList"
 * "app/bookings/list/_components/booking-status" → "BookingStatus"
 */
export function toComponentName(target: string): string {
  const base = path.basename(target)
  return base
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

/**
 * Derive the route URL path from the app directory path.
 * "app/bookings/list" → "/bookings/list"
 */
export function toRoutePath(target: string): string {
  const match = target.match(/app\/(.+)/)
  if (!match) return '/' + target
  return '/' + match[1]
}
