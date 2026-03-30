import type { Meta, StoryObj } from '@storybook/react'
import { Shell } from '@/lib/shell'
import { LoginForm } from './LoginForm'
import { fixtures } from './fixtures'

const meta: Meta<typeof LoginForm> = {
  component: LoginForm,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof LoginForm>

export const Idle: Story       = { args: { initialState: fixtures.idle } }
export const Submitting: Story = { args: { initialState: fixtures.submitting } }
export const Error: Story      = { args: { initialState: fixtures.error } }

export const InFullPage: Story = {
  args: { initialState: fixtures.idle },
  decorators: [(Story) => <Shell.FullPage><Story /></Shell.FullPage>],
}

export const InCard: Story = {
  args: { initialState: fixtures.idle },
  decorators: [(Story) => <div className="p-8"><Shell.Card><Story /></Shell.Card></div>],
}

export const InModal: Story = {
  args: { initialState: fixtures.idle },
  decorators: [(Story) => <Shell.Modal open onClose={() => {}}><Story /></Shell.Modal>],
}

export const InDrawerRight: Story = {
  args: { initialState: fixtures.idle },
  decorators: [(Story) => <Shell.Drawer open onClose={() => {}} side="right"><Story /></Shell.Drawer>],
}

export const InDrawerLeft: Story = {
  args: { initialState: fixtures.idle },
  decorators: [(Story) => <Shell.Drawer open onClose={() => {}} side="left"><Story /></Shell.Drawer>],
}
