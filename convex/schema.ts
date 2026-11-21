import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Everything is scoped by `vault`: a SHA-256 hash of the user's private sync
 * code. The code itself never leaves the device, so the database never sees it.
 */
export default defineSchema({
  // Workout templates. `deleted` is a tombstone so deletions sync too.
  templates: defineTable({
    vault: v.string(),
    tid: v.string(),
    data: v.any(),
    updatedAt: v.number(),
    deleted: v.boolean(),
  }).index('by_vault_tid', ['vault', 'tid']),

  // Finished workouts. Append-only: never edited after they're logged.
  sessions: defineTable({
    vault: v.string(),
    sid: v.string(),
    data: v.any(),
    startedAt: v.number(),
  }).index('by_vault_sid', ['vault', 'sid']),

  // The in-progress workout (or null), one row per vault.
  active: defineTable({
    vault: v.string(),
    data: v.any(),
    updatedAt: v.number(),
  }).index('by_vault', ['vault']),
})
