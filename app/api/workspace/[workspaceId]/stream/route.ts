import { getSession } from '@/lib/auth/session'
import { getUserWorkspaces, isPlatformAdmin } from '@/lib/workspace/memberships'
import { readWorkspacePulse } from '@/lib/realtime/pulse'

const POLL_MS = 3_000
// Close a touch before the platform function limit (300s) so the client's
// EventSource reconnects cleanly rather than being killed mid-frame.
const MAX_MS = 280_000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Per-workspace SSE liveness stream (see docs/realtime.md). Holds the
 * connection and polls the workspace_pulse row every few seconds; emits a
 * thin `pulse` event when the version changes (no payload — the receiver
 * re-runs its own scoped query, so the auth wall holds). Auth: the caller
 * must be a member of this workspace or a platform admin. Heartbeat comments
 * keep proxies from dropping an idle stream.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params
  const id = Number(workspaceId)
  if (!Number.isInteger(id)) return new Response('Bad request', { status: 400 })

  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = Number(session.userId)
  const memberships = await getUserWorkspaces(userId)
  const allowed = memberships.some((w) => w.id === id) || (await isPlatformAdmin(userId))
  if (!allowed) return new Response('Forbidden', { status: 403 })

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { closed = true }
      }
      const heartbeat = () => {
        if (closed) return
        try { controller.enqueue(encoder.encode(`: ping\n\n`)) } catch { closed = true }
      }

      let last = (await readWorkspacePulse(id)).version
      send('ready', { version: last })

      const startedAt = Date.now()
      while (!closed && Date.now() - startedAt < MAX_MS) {
        await sleep(POLL_MS)
        if (closed) break
        try {
          const cur = await readWorkspacePulse(id)
          if (cur.version !== last) {
            last = cur.version
            send('pulse', cur)
          } else {
            heartbeat()
          }
        } catch {
          heartbeat()
        }
      }
      if (!closed) {
        try { controller.close() } catch { /* already closed */ }
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
