'use client'

import { cn } from '../utils'
import { ShellBase, type ShellProps } from './shell-base'

export function Drawer({
  children, open, onClose, side = 'right', ...props
}: ShellProps & { open: boolean; onClose: () => void; side?: 'left' | 'right' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative z-50 flex h-full w-full max-w-md flex-col bg-background p-6 shadow-xl',
        side === 'right' ? 'ml-auto' : 'mr-auto'
      )}>
        <ShellBase {...props}>{children}</ShellBase>
      </div>
    </div>
  )
}
