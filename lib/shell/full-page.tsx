import { ShellBase, type ShellProps } from './shell-base'

export function FullPage({ children, ...props }: ShellProps) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <ShellBase {...props}>{children}</ShellBase>
    </main>
  )
}
