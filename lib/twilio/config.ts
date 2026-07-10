const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

/**
 * Feature flag: the phone-OTP auth channel is active only when all three
 * TWILIO_* env vars are present. Unset = email-only auth — the auth actions
 * gate on this BEFORE calling Twilio, so a template app without Twilio
 * configured never breaks, it just rejects phone identifiers up front.
 */
export function isTwilioEnabled(): boolean {
  return Boolean(accountSid && authToken && serviceSid)
}

export function getTwilioConfig() {
  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Missing Twilio env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID')
  }
  return { accountSid, authToken, serviceSid }
}
