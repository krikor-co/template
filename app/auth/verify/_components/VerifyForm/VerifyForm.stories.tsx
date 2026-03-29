import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { VerifyForm } from './VerifyForm'
import { fixtures } from './fixtures'

const meta: Meta<typeof VerifyForm> = {
  component: VerifyForm,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof VerifyForm>

export const Idle: Story       = { args: { initialState: fixtures.idle } }
export const Submitting: Story = { args: { initialState: fixtures.submitting } }
export const Error: Story      = { args: { initialState: fixtures.error } }
export const Success: Story    = { args: { initialState: fixtures.success } }
