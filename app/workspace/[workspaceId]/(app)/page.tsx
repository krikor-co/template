import { Suspense } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces } from '@/db/schema'

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center" aria-busy="true">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        </main>
      }
    >
      <WorkspaceHome workspaceId={workspaceId} />
    </Suspense>
  )
}

async function WorkspaceHome({ workspaceId }: { workspaceId: string }) {
  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, Number(workspaceId)))
    .limit(1)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Workspace</p>
      <h1 className="text-2xl font-semibold">{workspace?.name ?? 'Workspace'}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This is the workspace home stub. Build your tenant-scoped app under{' '}
        <code>app/workspace/[workspaceId]/</code> — see <code>docs/tenancy.md</code>.
      </p>
    </main>
  )
}
