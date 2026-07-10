import type { Meta, StoryObj } from '@storybook/react'
import { StatusPill } from './StatusPill'

const meta: Meta<typeof StatusPill> = {
  component: StatusPill,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof StatusPill>

export const Paid: Story = { args: { status: 'paid' } }
export const Pending: Story = { args: { status: 'pending' } }
export const Overdue: Story = { args: { status: 'overdue' } }
export const Urgent: Story = { args: { status: 'urgent', label: 'URGENT' } }
export const Info: Story = { args: { status: 'info', label: 'AI' } }
export const Small: Story = { args: { status: 'active', size: 'sm' } }

export const Taxonomy: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill status="paid" />
      <StatusPill status="pending" />
      <StatusPill status="partial" />
      <StatusPill status="overdue" />
      <StatusPill status="cancelled" />
      <StatusPill status="active" />
      <StatusPill status="urgent" label="URGENT" />
      <StatusPill status="info" label="Informational" />
      <StatusPill status="default" label="Neutral" />
    </div>
  ),
}
