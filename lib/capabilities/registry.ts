import type { Capability, ActionCapability, QueryCapability } from './types'

/**
 * The Capability Registry — every app OPERATION registers here exactly once.
 * Ships EMPTY: as features grow, co-locate a `capability.ts` beside the section
 * that owns the operation, import it here, and add it to `ALL`:
 *
 *   import { createProjectCap } from '@/app/workspace/[workspaceId]/(app)/projects/_sections/ProjectForm/capability'
 *   const ALL: Capability[] = [createProjectCap as Capability]
 *
 * See docs/capabilities.md for the full contract and a worked example.
 */
const ALL: Capability[] = []

export const CAPABILITIES: Record<string, Capability> = Object.fromEntries(ALL.map((c) => [c.id, c]))
export const ACTION_CAPS = ALL.filter((c): c is ActionCapability<unknown, unknown> => c.kind === 'action')
export const QUERY_CAPS  = ALL.filter((c): c is QueryCapability<unknown, unknown> => c.kind === 'query')
export function getCapability(id: string): Capability | undefined { return CAPABILITIES[id] }
