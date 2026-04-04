import React from 'react'
import { Shell } from '../shell'

export type ShellType = 'none' | 'fullpage' | 'card' | 'modal' | 'drawer-right' | 'drawer-left'

export function ShellDecorator({
  shell,
  children,
}: {
  shell: ShellType
  children: React.ReactNode
}) {
  switch (shell) {
    case 'fullpage':
      return <Shell.FullPage>{children}</Shell.FullPage>
    case 'card':
      return (
        <div className="p-8">
          <Shell.Card>{children}</Shell.Card>
        </div>
      )
    case 'modal':
      return (
        <Shell.Modal open onClose={() => {}}>
          {children}
        </Shell.Modal>
      )
    case 'drawer-right':
      return (
        <Shell.Drawer open onClose={() => {}} side="right">
          {children}
        </Shell.Drawer>
      )
    case 'drawer-left':
      return (
        <Shell.Drawer open onClose={() => {}} side="left">
          {children}
        </Shell.Drawer>
      )
    default:
      return <>{children}</>
  }
}
