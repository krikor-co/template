import type { Meta, StoryObj } from '@storybook/react'
import { Shell } from './shell'

const meta: Meta = { title: 'Shell' }
export default meta

export const FullPage: StoryObj = {
  render: () => (
    <Shell.FullPage title="Example Section">
      <p className="text-sm text-muted-foreground">Section content goes here.</p>
    </Shell.FullPage>
  ),
}

export const Card: StoryObj = {
  render: () => (
    <Shell.Card title="Card Section">
      <p className="text-sm text-muted-foreground">Inline card content.</p>
    </Shell.Card>
  ),
}

export const ModalOpen: StoryObj = {
  render: () => (
    <Shell.Modal open onClose={() => {}} title="Modal Title">
      <p className="text-sm">Modal body content.</p>
    </Shell.Modal>
  ),
}

export const DrawerOpen: StoryObj = {
  render: () => (
    <Shell.Drawer open onClose={() => {}} title="Drawer Title">
      <p className="text-sm">Drawer body content.</p>
    </Shell.Drawer>
  ),
}

export const ModalLongBody: StoryObj = {
  render: () => (
    <Shell.Modal open onClose={() => {}} title="Scrolling Modal">
      <div className="space-y-3">
        {Array.from({ length: 40 }, (_, i) => (
          <p key={i} className="text-sm text-muted-foreground">
            Row {i + 1} — the body scrolls inside the panel; the title and ✕ stay pinned.
          </p>
        ))}
      </div>
    </Shell.Modal>
  ),
}

export const DrawerLongBody: StoryObj = {
  render: () => (
    <Shell.Drawer open onClose={() => {}} title="Scrolling Drawer">
      <div className="space-y-3">
        {Array.from({ length: 60 }, (_, i) => (
          <p key={i} className="text-sm text-muted-foreground">
            Row {i + 1} — the body scrolls inside the panel; the title and ✕ stay pinned.
          </p>
        ))}
      </div>
    </Shell.Drawer>
  ),
}

export const DrawerFill: StoryObj = {
  render: () => (
    <Shell.Drawer open onClose={() => {}} title="Fill Drawer" fill>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i} className="text-sm text-muted-foreground">Message {i + 1}</p>
          ))}
        </div>
        <div className="border-t border-border pt-3">
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Pinned composer"
          />
        </div>
      </div>
    </Shell.Drawer>
  ),
}
