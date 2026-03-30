import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { insertTestOtp, maxOutOtpAttempts } from '../helpers/test-api'
import { completeIdentifyStep, completeRegisterStep, completeVerifyStep } from '../helpers/auth'

/**
 * Creates a new user and lands on /auth/verify with a known OTP planted in the DB.
 * Returns the email for further OTP insertions if needed.
 */
async function reachVerifyPage(page: Parameters<typeof completeIdentifyStep>[0], request: APIRequestContext) {
  const email = `playwright+${crypto.randomUUID()}@test.invalid`
  await completeIdentifyStep(page, email)
  await page.waitForURL('**/auth/register', { timeout: 10_000 })
  await completeRegisterStep(page)
  await page.waitForURL('**/auth/verify', { timeout: 10_000 })
  await insertTestOtp(request, email)
  return email
}

test('invalid OTP shows error message', async ({ page, request }) => {
  await reachVerifyPage(page, request)

  await completeVerifyStep(page, '999999')

  await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="error-message"]')).toContainText(
    'Invalid or expired code'
  )
})

test('5 wrong attempts lock the OTP code', async ({ page, request }) => {
  const email = await reachVerifyPage(page, request)

  // Pre-set attempts to 4 via the test API so we only need 2 UI submissions:
  //   1. a wrong code → increments attempts to 5, returns error
  //   2. the correct code → MAX_ATTEMPTS check fires, record marked used, returns error
  await maxOutOtpAttempts(request, email)

  await completeVerifyStep(page, '111111')
  await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10_000 })

  await completeVerifyStep(page, '000000')
  await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10_000 })
  await expect(page).toHaveURL(/\/auth\/verify/, { timeout: 5_000 })
})
