import type { Page } from '@playwright/test'

/**
 * All three forms use `scene` with `minStay: 1000`. The state machine delays the
 * idle→submitting transition for up to 1s after mount. If SUCCESS arrives while
 * still in idle (no SUCCESS transition defined), it is silently dropped and the
 * component never navigates. Waiting 1100ms after the page loads ensures the
 * minStay has already elapsed before we submit, so the transition happens
 * immediately and SUCCESS is handled in the `submitting` state.
 */
const SCENE_MIN_STAY_MS = 1100

export async function completeIdentifyStep(page: Page, email: string) {
  await page.goto('/auth/identify')
  // Wait for the page to be fully interactive (JS loaded + hydrated) before
  // starting the minStay countdown, otherwise the wait may not be long enough.
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(SCENE_MIN_STAY_MS)
  await page.fill('input[name="email"]', email)
  await page.click('button[type="submit"]')
}

export async function completeRegisterStep(page: Page, name = 'Test User') {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(SCENE_MIN_STAY_MS)
  await page.fill('input[name="name"]', name)
  await page.click('button[type="submit"]')
}

export async function completeVerifyStep(page: Page, code: string) {
  await page.waitForLoadState('networkidle')
  // First wait: let the current state's (idle OR error) minStay expire.
  await page.waitForTimeout(SCENE_MIN_STAY_MS)
  // Filling may trigger RETRY (error→idle). Wait again so the NEW idle's minStay expires.
  await page.fill('input[name="code"]', code)
  await page.waitForTimeout(SCENE_MIN_STAY_MS)
  await page.click('button[type="submit"]')
}
