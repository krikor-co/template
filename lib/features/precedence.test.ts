import { describe, expect, it } from 'vitest'
import { applyOverrides } from './precedence'

describe('applyOverrides — most-specific-wins precedence', () => {
  const defaults = { 'area.on': true, 'area.off': false }

  it('returns a copy of the defaults when there are no override rows', () => {
    const out = applyOverrides(defaults, [])
    expect(out).toEqual(defaults)
    expect(out).not.toBe(defaults) // never mutates the input
  })

  it('global override beats the registry default', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global', featureKey: 'area.on', enabled: false },
    ])).toEqual({ 'area.on': false, 'area.off': false })
  })

  it('workspace override beats global', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global',    featureKey: 'area.off', enabled: true },
      { scope: 'workspace', featureKey: 'area.off', enabled: false },
    ])['area.off']).toBe(false)
  })

  it('user override beats workspace and global', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global',    featureKey: 'area.off', enabled: false },
      { scope: 'workspace', featureKey: 'area.off', enabled: false },
      { scope: 'user',      featureKey: 'area.off', enabled: true },
    ])['area.off']).toBe(true)
  })

  it('row order does not matter — precedence comes from scope, not position', () => {
    expect(applyOverrides(defaults, [
      { scope: 'user',   featureKey: 'area.on', enabled: true },
      { scope: 'global', featureKey: 'area.on', enabled: false },
    ])['area.on']).toBe(true)
  })

  it('ignores rows for keys not in the defaults (retired/unknown keys)', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global', featureKey: 'ghost.key', enabled: true },
    ])).toEqual(defaults)
  })

  it('ignores rows with unknown scopes', () => {
    expect(applyOverrides(defaults, [
      { scope: 'galaxy', featureKey: 'area.on', enabled: false },
    ])).toEqual(defaults)
  })
})
