import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('twilio config feature flag', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('isTwilioEnabled is false when any TWILIO_* var is missing', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '')
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', '')
    const { isTwilioEnabled } = await import('./config')
    expect(isTwilioEnabled()).toBe(false)
  })

  it('isTwilioEnabled is true when all three vars are set', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123')
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123')
    vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', 'VA123')
    const { isTwilioEnabled } = await import('./config')
    expect(isTwilioEnabled()).toBe(true)
  })

  it('getTwilioConfig throws when unset (fail-closed for direct callers)', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '')
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', '')
    const { getTwilioConfig } = await import('./config')
    expect(() => getTwilioConfig()).toThrow(/Missing Twilio env vars/)
  })
})
