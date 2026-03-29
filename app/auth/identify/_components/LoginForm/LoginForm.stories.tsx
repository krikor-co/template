import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { LoginForm } from './LoginForm'
import { fixtures } from './fixtures'

const meta: Meta<typeof LoginForm> = {
  component: LoginForm,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof LoginForm>

export const Idle: Story       = { args: { initialState: fixtures.idle } }
export const Submitting: Story = { args: { initialState: fixtures.submitting } }
export const Error: Story      = { args: { initialState: fixtures.error } }
