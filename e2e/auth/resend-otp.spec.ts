import { test, expect } from '@playwright/test'
import { insertTestOtp } from '../helpers/test-api'
import { completeIdentifyStep } from '../helpers/auth'

test.describe('resend OTP', () => {
  let email: string

  test.beforeAll(() => {
    email = `playwright+${crypto.randomUUID()}@test.invalid`
  })

  test('resend button appears after cooldown and new code works', async ({ page, request }) => {
    // Install fake timers before navigating so the 30s countdown can be fast-forwarded
    await page.clock.install()

    // Get to the verify page (new user → identify → register → verify)
    await page.goto('/auth/identify')
    await page.waitForLoadState('networkidle')
    await page.clock.fastForward(1200)
    await page.fill('input[name="email"]', email)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/auth/register', { timeout: 10_000 })

    await page.waitForLoadState('networkidle')
    await page.clock.fastForward(1200)
    await page.fill('input[name="name"]', 'Resend Test')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/auth/verify', { timeout: 10_000 })
    await page.waitForLoadState('networkidle')

    // Verify the countdown is showing
    await expect(page.getByText(/Resend code in \d+s/)).toBeVisible()

    // Resend button should NOT be visible yet
    await expect(page.getByRole('button', { name: 'Resend code' })).not.toBeVisible()

    // Fast-forward past the 30s cooldown in chunks to let React process state updates
    for (let i = 0; i < 31; i++) {
      await page.clock.fastForward(1_000)
    }

    // Now the resend button should appear
    const resendButton = page.getByRole('button', { name: 'Resend code' })
    await expect(resendButton).toBeVisible({ timeout: 5_000 })

    // Click resend
    await resendButton.click()

    // Should show sending state
    await expect(page.getByText('Sending…')).toBeVisible()

    // Wait for "Code sent!" confirmation
    await expect(page.getByText('Code sent!')).toBeVisible({ timeout: 10_000 })

    // Plant a known OTP and verify it works
    const code = await insertTestOtp(request, email)

    // Wait for the scene minStay to expire
    await page.clock.fastForward(1200)
    await page.fill('input[name="code"]', code)
    await page.clock.fastForward(1200)
    await page.click('button[type="submit"]')

    await page.waitForURL('**/dashboard', { timeout: 10_000 })
  })
})
