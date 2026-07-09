import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TONES, isTone, toneClasses, toneColor, toneColorAlpha, toneSurface, toneVar } from './tone'

describe('tone token contract', () => {
  it('builds CSS variable references per role', () => {
    expect(toneVar('positive')).toBe('var(--tone-positive)')
    expect(toneVar('positive', 'soft')).toBe('var(--tone-positive-soft)')
    expect(toneVar('urgent', 'deep')).toBe('var(--tone-urgent-deep)')
    expect(toneVar('info', 'fg')).toBe('var(--tone-info-fg)')
  })

  it('builds hsl() colors and alpha variants for SVG', () => {
    expect(toneColor('attention')).toBe('hsl(var(--tone-attention))')
    expect(toneColor('neutral', 'soft')).toBe('hsl(var(--tone-neutral-soft))')
    expect(toneColorAlpha('info', 0.2)).toBe('hsl(var(--tone-info) / 0.2)')
  })

  it('narrows unknown values with isTone (retired tone names must NOT validate)', () => {
    expect(isTone('positive')).toBe(true)
    expect(isTone('neutral')).toBe(true)
    expect(isTone('calm')).toBe(false)
    expect(isTone('accent')).toBe(false)
    expect(isTone(42)).toBe(false)
  })

  it('every runtime-composed class is covered by the tailwind safelist regex', () => {
    const configSource = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8')
    const match = configSource.match(/pattern:\s*\/(.+)\/\s*\}/)
    expect(match).not.toBeNull()
    const safelist = new RegExp(match![1])
    for (const tone of TONES) {
      const c = toneClasses(tone)
      for (const cls of [c.bg, c.bgSoft, c.text, c.textDeep, c.textFg, c.border, c.ring]) {
        expect(cls, `${cls} must match the safelist pattern`).toMatch(safelist)
      }
      expect(toneSurface(tone)).toBe(`tone-surface-${tone}`)
    }
  })
})
