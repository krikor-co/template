import type { Meta, StoryObj } from '@storybook/react'
import { LoginForm } from './_components/LoginForm/LoginForm'
import { fixtures } from './_components/LoginForm/fixtures'

const meta: Meta = { title: 'Pages/Auth/Identify' }
export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Enter your email to continue</p>
        </div>
        <LoginForm initialState={fixtures.idle} />
      </div>
    </div>
  ),
}

export const WithError: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Enter your email to continue</p>
        </div>
        <LoginForm initialState={fixtures.error} />
      </div>
    </div>
  ),
}
