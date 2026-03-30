import { test, expect } from '@playwright/test'
import { insertTestOtp } from '../helpers/test-api'
import { setAuthEmailCookie, setSessionCookie } from '../helpers/cookies'
import { completeIdentifyStep, completeRegisterStep, completeVerifyStep } from '../helpers/auth'

let sessionToken = ''
let existingEmail = ''

test.beforeAll(async ({ browser, request }) => {
  // Create a real session via full new-user signup to use in guard tests
  const email = `playwright+${crypto.randomUUID()}@test.invalid`
  existingEmail = email

  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/auth/identify')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1100)
  await page.fill('input[name="email"]', email)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/auth/register', { timeout: 10_000 })

  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1100)
  await page.fill('input[name="name"]', 'Guard Test User')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/auth/verify', { timeout: 10_000 })

  const code = await insertTestOtp(request, email)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1100)
  await page.fill('input[name="code"]', code)
  await page.waitForTimeout(1100)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10_000 })

  const cookies = await context.cookies()
  sessionToken = cookies.find((c) => c.name === 'session_token')?.value ?? ''
  await context.close()
})

test('direct /auth/verify (no cookies) → redirect to /auth/identify', async ({ page }) => {
  await page.goto('/auth/verify')
  await expect(page).toHaveURL(/\/auth\/identify/, { timeout: 10_000 })
})

test('direct /auth/register (no cookies) → redirect to /auth/identify', async ({ page }) => {
  await page.goto('/auth/register')
  await expect(page).toHaveURL(/\/auth\/identify/, { timeout: 10_000 })
})

test('/auth/register with existing auth_email (not new) → redirect to /auth/verify', async ({
  browser,
}) => {
  const context = await browser.newContext()
  await setAuthEmailCookie(context, existingEmail, false)
  const page = await context.newPage()

  await page.goto('/auth/register')
  await expect(page).toHaveURL(/\/auth\/verify/, { timeout: 10_000 })
  await context.close()
})

test('authenticated user visiting /auth/identify → redirect to /dashboard', async ({
  browser,
}) => {
  const context = await browser.newContext()
  await setSessionCookie(context, sessionToken)
  const page = await context.newPage()

  await page.goto('/auth/identify')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
  await context.close()
})

test('/auth/verify with auth_is_new cookie → redirect to /auth/register', async ({
  browser,
}) => {
  const email = `playwright+${crypto.randomUUID()}@test.invalid`
  const context = await browser.newContext()
  await setAuthEmailCookie(context, email, true)
  const page = await context.newPage()

  await page.goto('/auth/verify')
  await expect(page).toHaveURL(/\/auth\/register/, { timeout: 10_000 })
  await context.close()
})
