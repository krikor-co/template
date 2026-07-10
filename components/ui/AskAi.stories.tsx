import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { AskAi } from './AskAi'

const meta: Meta<typeof AskAi> = {
  component: AskAi,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof AskAi>

function Controlled() {
  const [q, setQ] = useState('')
  return <AskAi value={q} onChange={setQ} onSubmit={(x) => alert(x)} />
}

export const Default: Story = {
  render: () => <Controlled />,
}

export const WithAffordances: Story = {
  render: () => (
    <AskAi
      onSubmit={(x) => alert(x)}
      onMic={() => {}}
      onAttach={() => {}}
      onSettings={() => {}}
    />
  ),
}

export const NoGlow: Story = {
  render: () => <AskAi glow={false} onSubmit={(x) => alert(x)} onMic={() => {}} />,
}

export const Disabled: Story = {
  args: { disabled: true, onMic: () => {} },
}
