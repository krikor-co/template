import type { Meta, StoryObj } from '@storybook/react'
import { RecentAddedPeople } from './RecentAddedPeople'
import { fixtures } from './fixtures'

const meta: Meta<typeof RecentAddedPeople> = {
  component: RecentAddedPeople,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof RecentAddedPeople>

export const Idle: Story  = { args: { initialState: fixtures.idle } }
export const Error: Story = { args: { initialState: fixtures.error } }
