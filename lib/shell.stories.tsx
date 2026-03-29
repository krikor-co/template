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
