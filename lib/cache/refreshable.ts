/**
 * REFRESHABLE — the app's refreshable-widget tag union (empty-registry pattern,
 * like FEATURE_REGISTRY). Each entry maps a stable widget-facing name to a thunk
 * that invalidates that widget's cache tags THROUGH ITS OWN section registry
 * (docs/caching.md) — `invalidate` uses `updateTag`, so the thunks only run
 * inside the `refreshTags` server action.
 *
 * Register an entry when a server-cached widget gains a <WidgetRefresh> button:
 *
 *   import { Tag, invalidate } from '@/app/dashboard/Bookings/tags'
 *
 *   export const REFRESHABLE = {
 *     bookings: () => invalidate(Tag.bookings({})),
 *   } satisfies Record<string, () => void>
 *
 * Client-loader widgets (Type 6) don't register here — they refresh via the
 * `{ onRefresh }` source mode instead.
 */
export const REFRESHABLE = {} satisfies Record<string, () => void>

/** The app tag union — widget names that `refreshTags` accepts. */
export type RefreshTagName = keyof typeof REFRESHABLE
