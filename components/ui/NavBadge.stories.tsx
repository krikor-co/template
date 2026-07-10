import type { Meta, StoryObj } from '@storybook/react'
import { NavBadge } from './NavBadge'

const meta: Meta<typeof NavBadge> = {
  component: NavBadge,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof NavBadge>

export const Overdue: Story = { args: { count: 3, tone: 'overdue' } }
export const Pending: Story = { args: { count: 7, tone: 'pending' } }
export const Neutral: Story = { args: { count: 12, tone: 'neutral' } }
export const Clamped: Story = { args: { count: 42, tone: 'overdue', max: 9 } }
/** Renders nothing when count is 0. */
export const Zero: Story = { args: { count: 0, tone: 'pending' } }
