---
title: Rate Limiting
order: 7
category: Infrastructure
---

# Rate Limiting

Rate limiting is a framework primitive in `lib/rate-limit.ts`. It protects server actions from abuse — brute-force attacks, quota exhaustion, spam.

## Setup

`createRateLimit` defines a limiter scoped to an action name, with a maximum attempt count and a sliding window:

```typescript
import { createRateLimit, getClientIp } from '@/lib/rate-limit'

const sendOtpLimit = createRateLimit({
  action: 'send_otp',
  max: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
})
```

## Usage in actions

Call `.check(...keys)` at the top of any server action, after validation but before domain logic. Pass one or more keys — each is checked independently. If **any** key exceeds the limit, the request is denied.

```typescript
export async function sendLoginOtp(formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { success: false, error: 'Invalid email.' }

  const { email } = parsed.data
  const ip = await getClientIp()
  const limit = await sendOtpLimit.check(email, ip)
  if (!limit.ok) return { success: false, error: limit.error }

  // ... domain logic
}
```

## Key strategy

Use **email** to prevent spamming a specific address. Use **IP** to prevent distributed attacks across addresses. Passing both means either one hitting the ceiling blocks the request.

| Action | Recommended max | Window | Keys |
|--------|----------------|--------|------|
| OTP send (login, register) | 3 | 15 min | email, IP |
| OTP verify | 5 | 15 min | email, IP |

## Storage

Rate limits are stored in the `rate_limits` database table with a compound index on `(key, action)`. This survives deploys and works across serverless instances, unlike in-memory counters.

## Return type

`.check()` returns `{ ok: true }` or `{ ok: false, error: string }` — fits the existing action result pattern with no UI changes needed.
