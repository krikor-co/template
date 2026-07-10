import { cn } from '@/lib/utils'

/** Shared input chrome — the template's form-control surface. Reused by
 *  Textarea, DatePicker's trigger, MoneyInput and PhoneInput so every
 *  text-like control shares one look. */
export const inputChrome =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors ' +
  'placeholder:text-muted-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputChrome, className)} {...props} />
}
