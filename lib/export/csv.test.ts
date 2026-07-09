import { describe, expect, it } from 'vitest'
import { csvDate, csvMoney, toCsv, type CsvColumn } from './csv'

describe('toCsv', () => {
  const columns: CsvColumn<{ name: string; note: string }>[] = [
    { header: 'Name', value: (r) => r.name },
    { header: 'Note', value: (r) => r.note },
  ]

  it('emits BOM + header + CRLF-terminated rows', () => {
    expect(toCsv([{ name: 'Ana', note: 'hi' }], columns))
      .toBe('\uFEFFName,Note\r\nAna,hi\r\n')
  })

  it('quotes fields with delimiters/newlines and doubles embedded quotes (RFC 4180)', () => {
    expect(toCsv([{ name: 'a,b', note: 'say "hi"\nok' }], columns))
      .toBe('\uFEFFName,Note\r\n"a,b","say ""hi""\nok"\r\n')
  })

  it('emits the header row alone for empty input', () => {
    expect(toCsv([], columns)).toBe('\uFEFFName,Note\r\n')
  })
})

describe('csvDate', () => {
  it('defaults to locale-neutral ISO yyyy-MM-dd in UTC', () => {
    expect(csvDate('2026-07-08T23:30:00.000Z')).toBe('2026-07-08')
  })

  it('renders dd/MM/yyyy when explicitly requested', () => {
    expect(csvDate('2026-07-08T23:30:00.000Z', { format: 'dd/MM/yyyy' })).toBe('08/07/2026')
  })

  it('uses the workspace timezone for the calendar day', () => {
    // 01:30Z on the 9th is still 22:30 on the 8th in São Paulo (UTC-3).
    expect(csvDate('2026-07-09T01:30:00.000Z', { timeZone: 'America/Sao_Paulo' })).toBe('2026-07-08')
  })

  it('combines timezone and dd/MM/yyyy format', () => {
    expect(csvDate('2026-07-09T01:30:00.000Z', { timeZone: 'America/Sao_Paulo', format: 'dd/MM/yyyy' }))
      .toBe('08/07/2026')
  })

  it('returns empty string for absent or invalid input', () => {
    expect(csvDate(null)).toBe('')
    expect(csvDate(undefined)).toBe('')
    expect(csvDate('not-a-date')).toBe('')
  })
})

describe('csvMoney', () => {
  it('renders a plain two-decimal string, no symbol', () => {
    expect(csvMoney(1234.5)).toBe('1234.50')
  })
})
