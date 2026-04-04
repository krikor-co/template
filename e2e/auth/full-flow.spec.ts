import { test, expect } from '@playwright/test'
import { insertTestOtp } from '../helpers/test-api'
import { completeIdentifyStep, completeRegisterStep, completeVerifyStep } from '../helpers/auth'

/**
 * Serial: tests run in order and share the email variable so that
 * test 2 can reuse the account created in test 1.
 */
test.describe.serial('auth happy paths', () => {
  let email: string

  test.beforeAll(() => {
    email = `playwright+${crypto.randomUUID()}@test.invalid`
  })

  test('new user signup: identify → register → verify → dashboard', async ({ page, request }) => {
    await completeIdentifyStep(page, email)
    await page.waitForURL('**/auth/register', { timeout: 10_000 })

    await completeRegisterStep(page)
    await page.waitForURL('**/auth/verify', { timeout: 10_000 })

    // Replace the OTP that registerAction created with a known one
    const code = await insertTestOtp(request, email)
    await completeVerifyStep(page, code)

    await page.waitForURL('**/dashboard', { timeout: 10_000 })

    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'session_token')).toBeDefined()
  })

  test('existing user login: identify → verify → dashboard', async ({ page, request }) => {
    // email already exists from test 1 → sendLoginOtp branches to verify
    await completeIdentifyStep(page, email)
    await page.waitForURL('**/auth/verify', { timeout: 10_000 })

    const code = await insertTestOtp(request, email)
    await completeVerifyStep(page, code)

    await page.waitForURL('**/dashboard', { timeout: 10_000 })
  })

  test('returnTo is preserved through the full flow', async ({ page, request }) => {
    // Use a subpath distinct from the default '/dashboard' so we can assert it was honoured.
    // The identify page captures returnTo from the URL into the auth_return_to cookie;
    // the verify action reads it back and redirects there after successful OTP.
    await page.goto('/auth/identify?returnTo=%2Fdashboard%2Freturn-test')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1100)
    await page.fill('input[name="email"]', email)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/auth/verify', { timeout: 10_000 })

    const code = await insertTestOtp(request, email)
    await completeVerifyStep(page, code)

    await page.waitForURL('**/dashboard/return-test', { timeout: 15_000 })
  })
})
