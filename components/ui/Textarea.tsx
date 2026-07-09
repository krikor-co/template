import { cn } from '@/lib/utils'
import { inputChrome } from './Input'

/** Styled native `<textarea>` — mirrors Input's chrome. */
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputChrome, 'min-h-[88px] resize-y', className)} {...props} />
}
