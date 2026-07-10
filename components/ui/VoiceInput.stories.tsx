import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { VoiceInput } from './VoiceInput'

const meta: Meta<typeof VoiceInput> = {
  component: VoiceInput,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md bg-background p-6">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof VoiceInput>

function Toggleable() {
  const [listening, setListening] = useState(false)
  return <VoiceInput listening={listening} onToggle={() => setListening((v) => !v)} />
}

export const Interactive: Story = {
  render: () => <Toggleable />,
}

export const Idle: Story = {
  args: { listening: false, onToggle: () => {} },
}

export const Listening: Story = {
  args: { listening: true, onToggle: () => {} },
}
