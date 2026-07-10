import type { Meta, StoryObj } from '@storybook/react'
import { InsightCard } from './InsightCard'
import { Sparkline } from './Sparkline'

const meta: Meta<typeof InsightCard> = {
  component: InsightCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[360px] bg-background p-6">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof InsightCard>

export const Info: Story = {
  args: {
    variant: 'info',
    headline: 'Tuesday is your slowest day of the week.',
    body: 'Consider a mid-week promotion to balance the schedule.',
    cta: { label: 'View analysis →' },
  },
}

export const Forecast: Story = {
  args: {
    variant: 'forecast',
    headline: 'At the current pace, the month closes at $42,300.',
    body: 'About 8% above last month.',
    children: <Sparkline data={[12, 14, 13, 17, 19, 22, 26]} width={300} height={40} className="text-info-deep" />,
    cta: { label: 'Projection details →' },
  },
}

export const Anomaly: Story = {
  args: {
    variant: 'anomaly',
    severity: 'watch',
    headline: 'Payouts 23% above average this cycle.',
    body: 'Worth reviewing the last week of activity.',
    cta: { label: 'Review payouts →' },
  },
}

export const AnomalyAlarm: Story = {
  args: {
    variant: 'anomaly',
    severity: 'alarm',
    headline: '3 invoices went past due today without payment.',
    body: '$1,240 outstanding in total.',
    cta: { label: 'Follow up now →' },
  },
}

export const Nudge: Story = {
  args: {
    variant: 'nudge',
    headline: '5 customers have not returned in over 60 days.',
    body: 'A reminder could bring them back.',
    cta: { label: 'Send reminder →' },
    onFeedback: () => {},
  },
}

export const Paginated: Story = {
  args: {
    variant: 'info',
    headline: 'Your return rate rose 4% this month.',
    body: 'Customers are coming back more often.',
    page: { index: 2, total: 4 },
    onDismiss: () => {},
    onFeedback: () => {},
  },
}

export const Accent: Story = {
  args: {
    variant: 'forecast',
    surface: 'accent',
    headline: 'Good morning! Your AI summary is ready.',
    body: 'Projected revenue for today: $1,860.',
    page: { index: 1, total: 4 },
    cta: { label: 'View full summary →' },
  },
}

export const CustomPersona: Story = {
  args: {
    variant: 'forecast',
    kicker: 'ACME · FORECAST',
    headline: 'Demand should peak on Friday.',
    body: 'Kicker text is a prop — brand it per app.',
  },
}
