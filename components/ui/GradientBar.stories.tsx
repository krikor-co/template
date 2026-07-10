import type { Meta, StoryObj } from '@storybook/react'
import { GradientBar } from './GradientBar'

const meta: Meta<typeof GradientBar> = {
  component: GradientBar,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof GradientBar>

const week = [
  { label: 'Mon', value: 320 },
  { label: 'Tue', value: 480 },
  { label: 'Wed', value: 410 },
  { label: 'Thu', value: 690 },
  { label: 'Fri', value: 540 },
  { label: 'Sat', value: 760 },
  { label: 'Sun', value: 210 },
]

export const Default: Story = {
  args: { data: week, activeIndex: 5, valueLabel: '$760' },
}

export const Info: Story = {
  args: { data: week, activeIndex: 3, valueLabel: '$690', tone: 'info' },
}

export const Empty: Story = {
  args: { data: week.map((d) => ({ ...d, value: 0 })), activeIndex: 0 },
}
