import type { Meta, StoryObj } from '@storybook/react'
import { VerifyForm } from './_components/VerifyForm/VerifyForm'
import { fixtures } from './_components/VerifyForm/fixtures'

const meta: Meta = { title: 'Pages/Auth/Verify' }
export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a 6-digit code to <strong>{fixtures.idle.email}</strong>
          </p>
        </div>
        <VerifyForm initialState={fixtures.idle} />
      </div>
    </div>
  ),
}

export const WithError: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a 6-digit code to <strong>{fixtures.error.email}</strong>
          </p>
        </div>
        <VerifyForm initialState={fixtures.error} />
      </div>
    </div>
  ),
}

export const Verified: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <VerifyForm initialState={fixtures.success} />
      </div>
    </div>
  ),
}
