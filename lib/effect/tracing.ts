import { NodeSdk } from '@effect/opentelemetry'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { DbSpanExporter } from './db-span-exporter'

/**
 * Tracing Layer — provided by `runAction` and `runQuery`. Without this,
 * `Effect.withSpan(...)` is a silent no-op.
 *
 * Spans are persisted to our Postgres `trace_span` table via DbSpanExporter.
 * Use SQL to query traces, or wire an /admin/traces page later. Add a
 * retention cron to purge old rows (see docs/cron.md once the cron
 * convention lands).
 *
 * `BatchSpanProcessor` buffers (default 512 spans / 5s flush) so the DB
 * isn't hammered per-action. Sampling is 100% currently — revisit if
 * volume becomes a problem.
 */
export const TracingLayer = NodeSdk.layer(() => ({
  resource:      { serviceName: process.env.OTEL_SERVICE_NAME ?? process.env.npm_package_name ?? 'template' },
  spanProcessor: new BatchSpanProcessor(new DbSpanExporter()),
}))
