import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server'
import { v } from 'convex/values'

// Vault keys are 64-char hex SHA-256 digests of the client's sync code.
const vault = v.string()
const isVault = (s: string) => /^[0-9a-f]{64}$/.test(s)

/** Everything stored for a vault. The client subscribes to this. */
export const pull = query({
  args: { vault },
  handler: async (ctx, { vault }) => {
    if (!isVault(vault)) throw new Error('Invalid vault')
    const [templates, sessions, active] = await Promise.all([
      ctx.db.query('templates').withIndex('by_vault_tid', (q) => q.eq('vault', vault)).collect(),
      ctx.db.query('sessions').withIndex('by_vault_sid', (q) => q.eq('vault', vault)).collect(),
      ctx.db.query('active').withIndex('by_vault', (q) => q.eq('vault', vault)).unique(),
    ])
    return {
      templates: templates.map((t) => ({ tid: t.tid, data: t.data, updatedAt: t.updatedAt, deleted: t.deleted })),
      sessions: sessions.map((s) => s.data),
      active: active ? { data: active.data, updatedAt: active.updatedAt } : null,
    }
  },
})

/**
 * Upload local changes. Templates and the active workout are last-write-wins
 * by `updatedAt`; sessions are insert-only.
 */
export const push = mutation({
  args: {
    vault,
    templates: v.array(v.object({ tid: v.string(), data: v.any(), updatedAt: v.number(), deleted: v.boolean() })),
    sessions: v.array(v.object({ sid: v.string(), data: v.any(), startedAt: v.number() })),
    active: v.optional(v.object({ data: v.any(), updatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    if (!isVault(args.vault)) throw new Error('Invalid vault')

    for (const t of args.templates) {
      const existing = await ctx.db
        .query('templates')
        .withIndex('by_vault_tid', (q) => q.eq('vault', args.vault).eq('tid', t.tid))
        .unique()
      if (!existing) await ctx.db.insert('templates', { vault: args.vault, ...t })
      else if (t.updatedAt > existing.updatedAt) await ctx.db.patch(existing._id, t)
    }

    for (const s of args.sessions) {
      const existing = await ctx.db
        .query('sessions')
        .withIndex('by_vault_sid', (q) => q.eq('vault', args.vault).eq('sid', s.sid))
        .unique()
      if (!existing) await ctx.db.insert('sessions', { vault: args.vault, ...s })
    }

    if (args.active) {
      const existing = await ctx.db.query('active').withIndex('by_vault', (q) => q.eq('vault', args.vault)).unique()
      if (!existing) await ctx.db.insert('active', { vault: args.vault, ...args.active })
      else if (args.active.updatedAt > existing.updatedAt) await ctx.db.patch(existing._id, args.active)
    }
  },
})
