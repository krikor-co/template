import { Label } from './Label'
import { cn } from '@/lib/utils'

/**
 * Form field wrapper — pairs a Label with a control and renders optional hint +
 * error text with the right a11y wiring. Use around Input/Select/Textarea:
 *
 *   <Field htmlFor="email" label="Email" error={errors.email}>
 *     <Input id="email" name="email" />
 *   </Field>
 */
export function Field({
  htmlFor,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  htmlFor?:  string
  label?:    React.ReactNode
  required?: boolean
  hint?:     React.ReactNode
  error?:    React.ReactNode
  className?: string
  children:  React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span aria-hidden className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
