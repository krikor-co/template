import { cn } from '@/lib/utils'

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground',
        'shadow-sm transition-opacity disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
