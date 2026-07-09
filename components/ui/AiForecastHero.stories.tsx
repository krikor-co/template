import type { Meta, StoryObj } from '@storybook/react'
import { AiForecastHero } from './AiForecastHero'

const meta: Meta<typeof AiForecastHero> = {
  component: AiForecastHero,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[420px] bg-background p-6">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof AiForecastHero>

export const Default: Story = {
  args: {
    label: 'Monthly revenue',
    actual: { value: '$31,480', caption: '21 days realized' },
    projected: { value: '$42,300', caption: 'projection through day 30' },
    delta: '+8%',
    trend: {
      actual: [18, 20, 19, 24, 27, 30, 31],
      projected: [31, 34, 37, 40, 42],
    },
  },
}

export const NoTrend: Story = {
  args: {
    label: 'Today',
    actual: { value: '$980', caption: 'so far' },
    projected: { value: '$1,860', caption: 'closing estimate' },
    delta: '+4%',
  },
}

export const NegativeDelta: Story = {
  args: {
    label: 'Weekly revenue',
    actual: { value: '$6,200', caption: '5 days realized' },
    projected: { value: '$8,100', caption: 'projection through Sunday' },
    delta: '-3%',
    trend: {
      actual: [22, 20, 18, 17, 16],
      projected: [16, 15, 14],
    },
  },
}

export const CustomPersona: Story = {
  args: {
    kicker: 'ACME · FORECAST',
    label: 'Pipeline value',
    actualLabel: 'Closed',
    projectedLabel: 'Forecast',
    actual: { value: '$310k' },
    projected: { value: '$425k' },
  },
}
