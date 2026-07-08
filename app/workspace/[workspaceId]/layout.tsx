import { redirect } from 'next/navigation'
import { requireWorkspaceRole, WorkspaceGuardError } from '@/app/workspace/guards'
import { route } from './contract'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  try {
    await requireWorkspaceRole(workspaceId, ['owner', 'member'])
  } catch (e) {
    if (e instanceof WorkspaceGuardError && e.reason === 'unauthenticated') {
      redirect(route.exits.login({ workspaceId }))
    }
    redirect(route.exits.dashboard())
  }
  return <>{children}</>
}
