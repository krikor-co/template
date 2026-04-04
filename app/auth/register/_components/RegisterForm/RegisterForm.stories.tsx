import type { Meta, StoryObj } from '@storybook/react'
import { RegisterForm } from './RegisterForm'
import { fixtures } from './fixtures'

const meta: Meta<typeof RegisterForm> = {
  component: RegisterForm,
  parameters: { nextjs: { appDirectory: true }, shell: true },
}
export default meta
type Story = StoryObj<typeof RegisterForm>

export const Idle: Story       = { args: { initialState: fixtures.idle } }
export const Submitting: Story = { args: { initialState: fixtures.submitting } }
export const Error: Story      = { args: { initialState: fixtures.error } }
export const Success: Story    = { args: { initialState: fixtures.success } }
