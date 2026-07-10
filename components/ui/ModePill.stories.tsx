import type { Meta, StoryObj } from '@storybook/react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { ModePill } from './ModePill'

const meta: Meta<typeof ModePill> = {
  component: ModePill,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof ModePill>

export const Secondary: Story = { args: { label: 'Card' } }
export const Outline: Story = { args: { label: 'Transfer', tone: 'outline', icon: <CreditCard /> } }
export const Recurrence: Story = { args: { label: 'monthly', icon: <RefreshCw /> } }

export const Pair: Story = {
  render: () => (
    <div className="flex items-center gap-1.5">
      <ModePill label="Card" icon={<CreditCard />} />
      <ModePill label="monthly" tone="outline" icon={<RefreshCw />} />
    </div>
  ),
}
