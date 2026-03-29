import type { Meta, StoryObj } from '@storybook/react'
import { RegisterForm } from './_components/RegisterForm/RegisterForm'
import { fixtures } from './_components/RegisterForm/fixtures'

const meta: Meta = { title: 'Pages/Auth/Register' }
export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-muted-foreground">Just your name to get started</p>
        </div>
        <RegisterForm initialState={fixtures.idle} />
      </div>
    </div>
  ),
}

export const WithError: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-muted-foreground">Just your name to get started</p>
        </div>
        <RegisterForm initialState={fixtures.error} />
      </div>
    </div>
  ),
}
