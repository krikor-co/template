import type { Meta, StoryObj } from '@storybook/react'
import { CreditCard, ShoppingBag, User, ClipboardCheck, Package } from 'lucide-react'
import { Stepper, Timeline, type Step, type TimelineEvent } from './Stepper'

const meta: Meta<typeof Stepper> = {
  component: Stepper,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Stepper>

const steps: Step[] = [
  { label: 'Customer', status: 'done' },
  { label: 'Items', description: '2 selected', status: 'current' },
  { label: 'Extras', status: 'upcoming' },
  { label: 'Payment', status: 'upcoming' },
  { label: 'Review', status: 'upcoming' },
]

export const Vertical: Story = { args: { steps } }

export const Horizontal: Story = { args: { steps, orientation: 'horizontal' } }

export const WithIcons: Story = {
  args: {
    steps: [
      { label: 'Customer', icon: <User className="size-4" />, status: 'done' },
      { label: 'Items', icon: <Package className="size-4" />, status: 'current' },
      { label: 'Extras', icon: <ShoppingBag className="size-4" />, status: 'upcoming' },
      { label: 'Payment', icon: <CreditCard className="size-4" />, status: 'upcoming' },
      { label: 'Review', icon: <ClipboardCheck className="size-4" />, status: 'upcoming' },
    ],
  },
}

const events: TimelineEvent[] = [
  { when: '14:32', title: 'Receipt issued', meta: '$180.00 · Card', tone: 'success' },
  { when: '13:10', title: 'Session completed', meta: 'Consultation', tone: 'brand' },
  { when: 'yesterday', title: 'Booking created', meta: 'by Ana', tone: 'info' },
  { when: 'Jun 12', title: 'Customer registered', tone: 'plain' },
]

export const TimelineDefault: StoryObj<typeof Timeline> = {
  render: (args) => <Timeline {...args} />,
  args: { events },
}
