import type { Meta, StoryObj } from '@storybook/react'
import { Gauge } from './Gauge'

const meta: Meta<typeof Gauge> = {
  component: Gauge,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Gauge>

export const Good: Story = {
  args: { value: 0.72, label: 'Return rate', sub: 'last 30 days', delta: '+4%' },
}

export const Watch: Story = {
  args: { value: 0.52, label: 'Occupancy', sub: 'this week' },
}

export const Bad: Story = {
  args: { value: 0.21, label: 'Monthly goal', delta: '-8%' },
}

export const Forced: Story = {
  args: { value: 0.66, label: 'Readiness', tone: 'success' },
}

export const Ring: Story = {
  args: { variant: 'ring', value: 64, label: 'Setup', tone: 'info' },
}

export const Empty: Story = {
  args: { value: NaN, label: 'Return rate' },
}
