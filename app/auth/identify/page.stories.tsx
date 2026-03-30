import type { Meta, StoryObj } from '@storybook/react'
import { LoginForm } from './_components/LoginForm/LoginForm'
import { fixtures } from './_components/LoginForm/fixtures'

const meta: Meta = { title: 'Pages/Auth/Identify' }
export default meta

function Page({ fixture }: { fixture: (typeof fixtures)[keyof typeof fixtures] }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <LoginForm initialState={fixture} />
      </div>
    </div>
  )
}

export const Idle: StoryObj       = { render: () => <Page fixture={fixtures.idle} /> }
export const Submitting: StoryObj = { render: () => <Page fixture={fixtures.submitting} /> }
export const Error: StoryObj      = { render: () => <Page fixture={fixtures.error} /> }
export const Success: StoryObj    = { render: () => <Page fixture={fixtures.success} /> }
