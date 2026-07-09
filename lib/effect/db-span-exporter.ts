import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import { ExportResultCode, suppressTracing, type ExportResult } from '@opentelemetry/core'
import { context } from '@opentelemetry/api'
import type { HrTime } from '@opentelemetry/api'
import { db } from '@/db/drizzle'
import { traceSpan } from '@/db/schema'

/**
 * OTel SpanExporter that persists spans to our Postgres `trace_span` table.
 *
 * Used by `lib/effect/tracing.ts`'s TracingLayer (wired through a
 * BatchSpanProcessor so writes are batched, default 512 spans / 5s flush).
 *
 * Why DB-not-OTLP: zero infrastructure dependency, spans queryable from our
 * existing tooling, can power an in-app /admin/traces page later. The cost is
 * we don't get standard tracing UIs (Jaeger/Tempo/Honeycomb) — for our scale
 * that's an acceptable trade.
 *
 * IMPORTANT: this exporter writes to the DB directly (not via `dbE.run`)
 * because going through the Effect adapter would emit MORE spans → infinite
 * recursion. Spans are external observation infrastructure; they must not
 * be observed.
 */
export class DbSpanExporter implements SpanExporter {
  async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    if (spans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS })
      return
    }
    try {
      const rows = spans.map((s) => {
        const ctx = s.spanContext()
        // Drizzle expects jsonb attributes as a plain object — sanitize symbol/fn values.
        const attributes = sanitizeAttributes(s.attributes)
        const workspaceId = pickWorkspaceId(attributes)
        const userId  = pickUserId(attributes)
        return {
          spanId:       ctx.spanId,
          traceId:      ctx.traceId,
          parentSpanId: getParentSpanId(s) ?? null,
          name:         s.name,
          startTs:      hrTimeToDate(s.startTime),
          durationMs:   hrTimeToMs(s.duration),
          status:       s.status.code === 2 ? 'error' : s.status.code === 1 ? 'ok' : 'unset',
          attributes,
          errorMessage: s.status.message ?? null,
          workspaceId,
          userId,
        }
      })
      // Wrap the insert in `suppressTracing` so any future pg-driver
      // OTel instrumentation (e.g. `@opentelemetry/instrumentation-pg`)
      // can't recurse: spans emitted by THIS write would be exported
      // by THIS exporter, which would emit more spans, ad infinitum.
      await context.with(suppressTracing(context.active()), () =>
        db.insert(traceSpan).values(rows),
      )
      resultCallback({ code: ExportResultCode.SUCCESS })
    } catch (err) {
      // We do NOT throw — exporter failures must not break the app.
      // Log + report failed so the SDK can decide whether to retry.
      console.error('[DbSpanExporter] insert failed:', err instanceof Error ? err.message : err)
      resultCallback({ code: ExportResultCode.FAILED, error: err as Error })
    }
  }

  shutdown():   Promise<void> { return Promise.resolve() }
  forceFlush(): Promise<void> { return Promise.resolve() }
}

// ─── helpers ────────────────────────────────────────────────────────────────

const hrTimeToDate = (hr: HrTime): Date => new Date(hr[0] * 1000 + hr[1] / 1e6)
const hrTimeToMs   = (hr: HrTime): number => Math.max(0, Math.round(hr[0] * 1000 + hr[1] / 1e6))

// OTel SDK exposes parent context differently across versions; try both shapes.
function getParentSpanId(s: ReadableSpan): string | undefined {
  const anyS = s as unknown as { parentSpanId?: string; parentSpanContext?: { spanId?: string } }
  return anyS.parentSpanId ?? anyS.parentSpanContext?.spanId
}

function sanitizeAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    } else if (Array.isArray(v)) {
      out[k] = v
    } else {
      // For nested objects: JSON-serialize so semantic info isn't lost as
      // `"[object Object]"`. Falls back to String(v) for non-serializable
      // values (functions, circular refs, BigInt, etc.).
      try {
        out[k] = JSON.parse(JSON.stringify(v))
      } catch {
        out[k] = String(v)
      }
    }
  }
  return out
}

/**
 * Attribute → nullable positive-int column. ONE helper for both id columns so
 * the number and string paths can't drift (the number path previously accepted
 * 0/negative/float values the string path rejected — and a float would fail
 * the integer column, dropping the whole batch). Boundary attributes carry RAW
 * caller input (e.g. `input.workspaceId` before validation), so anything that
 * isn't a positive integer is denormalized as null — the full raw value is
 * still preserved in the jsonb `attributes`. Exported for tests only.
 */
export function pickPositiveInt(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw > 0 ? raw : null
  if (typeof raw === 'string') {
    // Strict digit strings only — parseInt alone would accept '12abc'/'12.9'
    // as 12, silently denormalizing garbage input into an id column.
    if (!/^\d+$/.test(raw)) return null
    const n = Number.parseInt(raw, 10)
    if (Number.isSafeInteger(n) && n > 0) return n
  }
  return null
}

const pickWorkspaceId = (attrs: Record<string, unknown>): number | null =>
  pickPositiveInt(attrs.workspaceId)

const pickUserId = (attrs: Record<string, unknown>): number | null =>
  pickPositiveInt(attrs.userId)
