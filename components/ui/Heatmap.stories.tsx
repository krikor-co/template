import type { Meta, StoryObj } from '@storybook/react'
import { Heatmap } from './Heatmap'

const meta: Meta<typeof Heatmap> = {
  component: Heatmap,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Heatmap>

const weeks = 12
// Flat column-major series: 7 cells per column (one weekday each), `weeks` cols.
const data = Array.from({ length: weeks * 7 }).map((_, i) =>
  Math.max(0, Math.round(Math.sin(i / 4) * 3 + (i % 5))),
)

const ROWS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export const Default: Story = {
  args: { data, weekdayLabels: ROWS, tone: 'brand' },
}

export const Success: Story = {
  args: { data, weekdayLabels: ROWS, tone: 'success' },
}

export const DateKeyed: Story = {
  args: {
    tone: 'info',
    weekdayLabels: ROWS,
    data: Array.from({ length: 30 }).map((_, i) => ({
      date: new Date(2026, 5, i + 1).toISOString(),
      value: Math.max(0, Math.round(Math.cos(i / 3) * 4 + 4)),
    })),
  },
}

export const Empty: Story = {
  args: { data: [], weekdayLabels: ROWS, tone: 'success' },
}
