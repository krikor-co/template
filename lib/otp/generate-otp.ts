import { randomInt } from 'crypto'

export function generateOtp(length = 6): string {
  if (length < 4 || length > 10) throw new Error('OTP length must be between 4 and 10')
  const min = 10 ** (length - 1)
  const max = 10 ** length - 1
  return randomInt(min, max + 1).toString().padStart(length, '0')
}
