/**
 * Feature Registry — the single source of truth for WHAT features exist.
 *
 * PURE DATA. This module MUST NOT import `db`, drizzle, `server-only`, or any
 * runtime dependency, so a `'use client'` admin toggles UI can import it
 * directly to render the catalog. Persisted OVERRIDES live in the
 * `feature_flag` table; resolution lives in `lib/features/resolve.ts`
 * (server-only). This file only declares keys + metadata + defaults.
 *
 * Keys are STABLE + namespaced (`<area>.<feature>[.<sub>]`) — never rename a
 * shipped key; flag rows reference it by string.
 *
 * The registry ships EMPTY — add your app's features here, e.g.:
 *   { key: 'workspace.reports', label: 'Reports', group: 'Workspace',
 *     roles: ['owner'], defaultEnabled: true }
 */

export type FeatureDef = {
  /** Stable, namespaced identifier — the flag row's `feature_key`. */
  key: string
  /** Human label for the admin catalog UI (English default; localize in UI). */
  label: string
  /** Display grouping for the admin catalog UI. */
  group: string
  /** Roles the feature is meaningful for — the app's own role vocabulary (template seeds 'owner' | 'member' | 'admin'). */
  roles: string[]
  /** Default when no override row exists at any scope. */
  defaultEnabled: boolean
}

export const FEATURE_REGISTRY: FeatureDef[] = []

const REGISTRY_BY_KEY: Record<string, FeatureDef> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.key, f]),
)

/** Look up a single feature definition by its stable key. */
export function getFeature(key: string): FeatureDef | undefined {
  return REGISTRY_BY_KEY[key]
}
