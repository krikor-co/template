import type { Meta, StoryObj } from '@storybook/react'
import { Sparkles, Trophy, AlertTriangle } from 'lucide-react'
import { Tabs } from './Tabs'

const meta: Meta<typeof Tabs> = {
  component: Tabs,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Tabs>

export const Basic: Story = {
  args: {
    defaultValue: 'top',
    tabs: [
      { value: 'top', label: 'Top performers' },
      { value: 'attention', label: 'Needs attention' },
      { value: 'all', label: 'All' },
    ],
  },
}

export const WithCountsAndIcons: Story = {
  args: {
    defaultValue: 'attention',
    tabs: [
      { value: 'top', label: 'Top', icon: <Trophy /> },
      { value: 'attention', label: 'Attention', icon: <AlertTriangle />, count: 4 },
      { value: 'ai', label: 'AI insights', icon: <Sparkles />, count: 2, ai: true },
    ],
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    defaultValue: 'a',
    tabs: [
      { value: 'a', label: 'Day' },
      { value: 'b', label: 'Week' },
      { value: 'c', label: 'Month' },
    ],
  },
}
