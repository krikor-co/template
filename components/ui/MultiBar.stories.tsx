import type { Meta, StoryObj } from '@storybook/react'
import { MultiBar } from './MultiBar'
import { Tile } from './Tile'

const meta: Meta<typeof MultiBar> = {
  component: MultiBar,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof MultiBar>

export const IncomeVsExpense: Story = {
  render: (args) => (
    <Tile tone="plain" className="w-[420px] p-5">
      <MultiBar {...args} />
    </Tile>
  ),
  args: {
    labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
    signed: true,
    format: (n) => `$${Math.abs(n)}`,
    series: [
      { label: 'Income', tone: 'success', values: [1200, 1800, 900, 2100] },
      { label: 'Expenses', tone: 'destructive', values: [-700, -500, -1100, -650] },
    ],
  },
}

export const GroupedPlain: Story = {
  render: (args) => (
    <Tile tone="plain" className="w-[420px] p-5">
      <MultiBar {...args} />
    </Tile>
  ),
  args: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    series: [
      { label: 'Sessions', tone: 'info', values: [4, 7, 3, 6, 9, 12] },
      { label: 'Sign-ups', tone: 'warning', values: [2, 3, 1, 4, 5, 6] },
    ],
  },
}

export const SingleSeries: Story = {
  render: (args) => (
    <Tile tone="plain" className="w-[360px] p-5">
      <MultiBar {...args} />
    </Tile>
  ),
  args: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    showLegend: false,
    series: [{ label: 'Revenue', tone: 'success', values: [3200, 4100, 3800, 5200, 4900, 6100] }],
  },
}
