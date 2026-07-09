import type { Meta, StoryObj } from '@storybook/react'
import { LayoutDashboard, LogIn } from 'lucide-react'
import { SearchCommand } from './SearchCommand'
import { entry as dashboardEntry } from '@/app/dashboard/entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'

const meta: Meta<typeof SearchCommand> = {
  component: SearchCommand,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof SearchCommand>

/** Items carry typed hrefs from the RouteRegistry entries — never raw URL strings. */
export const Default: Story = {
  args: {
    groups: [
      {
        heading: 'Screens',
        items: [
          { id: 'dashboard', label: 'Dashboard', hint: 'Overview', icon: <LayoutDashboard />, href: dashboardEntry.href() },
          { id: 'sign-in', label: 'Sign in', hint: 'Auth', icon: <LogIn />, href: identifyEntry.href() },
        ],
      },
    ],
  },
}
