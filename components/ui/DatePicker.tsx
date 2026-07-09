'use client'

import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputChrome } from './Input'
import { Calendar } from './Calendar'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { parseIsoDate, toIsoDate, useDatePicker } from './useDatePicker'

type Props = {
  /** Form field name — when set, a hidden input submits the `YYYY-MM-DD` value
   *  exactly like the old `<input type="date">`. Omit for controlled-only use. */
  name?: string
  id?: string
  /** Seed value as `YYYY-MM-DD` (uncontrolled mode). */
  defaultValue?: string
  /** Controlled value as `YYYY-MM-DD`. When provided (with `onChange`), the
   *  parent owns the state and no internal state/hidden-input is used unless
   *  `name` is also passed. */
  value?: string
  /** Controlled change handler — receives the chosen `YYYY-MM-DD` string. */
  onChange?: (value: string) => void
  required?: boolean
  disabled?: boolean
  /** Lower bound (`YYYY-MM-DD`) — days before are disabled. */
  min?: string
  /** Upper bound (`YYYY-MM-DD`) — days after are disabled. */
  max?: string
  /** Placeholder shown on the trigger when no date is chosen. */
  placeholder?: string
  className?: string
  /** Notified with the chosen `YYYY-MM-DD` on every change (e.g. to clear an
   *  error state) — fires in BOTH controlled and uncontrolled modes. */
  onValueChange?: (value: string) => void
  /** BCP-47 locale for the trigger's date label. Defaults to the runtime locale — pass the app locale for SSR-stable output. */
  locale?: string
}

/**
 * Shadcn-style date picker: a trigger button showing the locale-formatted
 * date that opens a calendar in a popover. Selecting a day sets the value.
 *
 * Drop-in for raw `<input type="date" name=… />` — pass `name` + `defaultValue`
 * and it renders a hidden `<input>` so `formData.get(name)` keeps returning the
 * same `YYYY-MM-DD` string. For controlled use (filters, cross-field-derived
 * dates), pass `value` + `onChange` instead.
 */
export function DatePicker({
  name,
  id,
  defaultValue,
  value: controlledValue,
  onChange,
  required,
  disabled,
  min,
  max,
  placeholder,
  className,
  onValueChange,
  locale,
}: Props) {
  const resolvedLocale = locale ?? new Intl.DateTimeFormat().resolvedOptions().locale
  const isControlled = controlledValue !== undefined
  const local = useDatePicker(defaultValue)

  const value = isControlled ? controlledValue : local.value
  const selected = parseIsoDate(value)
  const minDate = parseIsoDate(min)
  const maxDate = parseIsoDate(max)

  const commit = (next: Date | undefined) => {
    const iso = toIsoDate(next)
    if (!isControlled) local.setValue(iso)
    onChange?.(iso)
    onValueChange?.(iso)
    local.setOpen(false)
  }

  const disabledMatcher = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]

  // Format the local-noon Date directly (NOT via formatDate(iso), which would
  // re-parse the YYYY-MM-DD as UTC midnight and shift a day back in negative-
  // offset zones). The grid picked a local day; show that same local day.
  const label = selected
    ? selected.toLocaleDateString(resolvedLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : (placeholder ?? '—')

  return (
    <Popover open={local.open} onOpenChange={local.setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            inputChrome,
            'flex items-center gap-2 text-left tabular-nums',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={commit}
          defaultMonth={selected ?? maxDate}
          disabled={disabledMatcher.length > 0 ? disabledMatcher : undefined}
          required={false}
        />
      </PopoverContent>
      {/* The value the form submits — identical `YYYY-MM-DD` shape to the old
          native date input. Rendered whenever a `name` is given. */}
      {name && <input type="hidden" name={name} value={value} required={required} />}
    </Popover>
  )
}
