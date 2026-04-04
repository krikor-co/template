import { ShellBase, type ShellProps } from './shell-base'

export function Card({ children, ...props }: ShellProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <ShellBase {...props}>{children}</ShellBase>
    </div>
  )
}
