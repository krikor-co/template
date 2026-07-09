import { describe, expect, it } from 'vitest'
import { isTenantPassthroughPath, tenantRewritePath } from './rewrite-path'

describe('isTenantPassthroughPath', () => {
  it('passes through already workspace-scoped paths', () => {
    expect(isTenantPassthroughPath('/workspace/3')).toBe(true)
    expect(isTenantPassthroughPath('/workspace/3/billing')).toBe(true)
    expect(isTenantPassthroughPath('/workspace')).toBe(true)
  })

  it('passes through the guards escape routes so login is reachable on a tenant host', () => {
    // Regression: unauthenticated visitor on a tenant host → workspace layout
    // redirects to /auth/identify?returnTo=… — the middleware must NOT rewrite
    // that onto /workspace/<id>/auth/identify (a route that does not exist).
    expect(isTenantPassthroughPath('/auth/identify')).toBe(true)
    expect(isTenantPassthroughPath('/auth/verify')).toBe(true)
    expect(isTenantPassthroughPath('/auth/register')).toBe(true)
    expect(isTenantPassthroughPath('/dashboard')).toBe(true)
    expect(isTenantPassthroughPath('/onboarding')).toBe(true)
    expect(isTenantPassthroughPath('/invite/abc123')).toBe(true)
    expect(isTenantPassthroughPath('/docs/guards')).toBe(true)
    expect(isTenantPassthroughPath('/admin')).toBe(true)
  })

  it('does not pass through tenant-owned paths', () => {
    expect(isTenantPassthroughPath('/')).toBe(false)
    expect(isTenantPassthroughPath('/settings')).toBe(false)
    expect(isTenantPassthroughPath('/billing')).toBe(false)
  })

  it('matches on segment boundaries, not raw prefixes', () => {
    expect(isTenantPassthroughPath('/authors')).toBe(false)
    expect(isTenantPassthroughPath('/dashboard-widgets')).toBe(false)
    expect(isTenantPassthroughPath('/workspaces')).toBe(false)
  })
})

describe('tenantRewritePath', () => {
  it('maps the bare host to the workspace home', () => {
    expect(tenantRewritePath('/', 7)).toBe('/workspace/7')
  })

  it('maps every other path 1:1 onto the canonical tree', () => {
    expect(tenantRewritePath('/settings', 7)).toBe('/workspace/7/settings')
    expect(tenantRewritePath('/billing?x=1'.split('?')[0], 42)).toBe('/workspace/42/billing')
  })
})
