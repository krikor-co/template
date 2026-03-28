import { createHash } from 'crypto'

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function verifyOtpHash(code: string, hash: string): boolean {
  return hashOtp(code) === hash
}
