/**
 * Device ↔ Convex sync.
 *
 * The app stays local-first: everything is saved on the device and works
 * offline. When a sync code is set, local changes are pushed to Convex shortly
 * after they happen, and changes from other devices stream in live.
 *
 * To avoid re-uploading everything on every change, we remember what was last
 * pushed (a small "stamp" per record) and only send records whose stamp moved.
 */
import { ConvexClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import type { RemoteSnapshot, Session, Template } from '@/stores/workouts'
import { useWorkoutStore } from '@/stores/workouts'
import { sha256Hex } from './code'
import { CODE_KEY, readLocal as read, sync, writeLocal as write } from './state'

export { sync }

const api = anyApi
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined
const PUSHED_KEY = 'wt:sync-pushed'

type Store = ReturnType<typeof useWorkoutStore>
// Resolved lazily: this module may load after startup (when sync is first turned on).
let store: Store
const ensureStore = () => (store ??= useWorkoutStore())
let client: ConvexClient | null = null
let unsubscribe: (() => void) | null = null
let stopWatching: (() => void) | null = null
let pushTimer: number | undefined
let pushing = false
let again = false

/** Last-pushed stamps: "t:<id>" → updatedAt (negative = deleted), "s:<id>" → 1, "a" → activeAt. */
let pushed: Record<string, number> = JSON.parse(read(PUSHED_KEY) ?? '{}')

/** Read fresh each time: connectivity can change mid-upload. */
const isOffline = () => navigator.onLine === false
const savePushed = () => write(PUSHED_KEY, JSON.stringify(pushed))

/** Convex rejects `undefined` values; a JSON round-trip drops them. */
const clean = <T>(x: T): T => JSON.parse(JSON.stringify(x))

export function initSync(s: Store) {
  store = s
  if (sync.code) start()
}

/** First device: create a new code and upload this device's data. */
export function createSync(code: string) {
  pushed = {}
  savePushed()
  setCode(code)
}

/** Another device: replace local data with what's synced under this code. */
export function linkSync(code: string) {
  ensureStore().resetForLink()
  pushed = {}
  savePushed()
  setCode(code)
}

/** Stop syncing on this device. Local data stays. */
export function unlinkSync() {
  stop()
  write(CODE_KEY, null)
  pushed = {}
  savePushed()
  sync.code = null
  sync.status = 'off'
  sync.lastSynced = null
}

function setCode(code: string) {
  stop()
  write(CODE_KEY, code)
  sync.code = code
  start()
}

function start() {
  ensureStore()
  if (!CONVEX_URL || !sync.code || client) return
  const vault = sha256Hex(sync.code)
  client = new ConvexClient(CONVEX_URL)
  sync.status = 'syncing'

  unsubscribe = client.onUpdate(
    api.sync!.pull!,
    { vault },
    async (remote: RemoteSnapshot) => {
      await store.applyRemote(remote)
      markRemoteAsPushed(remote)
      schedulePush(0)
    },
    () => { sync.status = 'error' },
  )

  stopWatching = store.$subscribe(() => schedulePush(), { detached: true })
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  schedulePush(0)
}

function stop() {
  clearTimeout(pushTimer)
  unsubscribe?.()
  stopWatching?.()
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  void client?.close()
  client = null
  unsubscribe = stopWatching = null
}

const onOnline = () => schedulePush(0)
const onOffline = () => { sync.status = 'offline' }

function schedulePush(delay = 800) {
  clearTimeout(pushTimer)
  pushTimer = window.setTimeout(push, delay)
}

/** What changed locally since the last successful push. */
function changes() {
  const templates: { tid: string; data: Template | null; updatedAt: number; deleted: boolean }[] = []
  for (const t of store.templates) {
    const at = t.updatedAt ?? 1
    if (pushed[`t:${t.id}`] !== at) templates.push({ tid: t.id, data: clean(t), updatedAt: at, deleted: false })
  }
  for (const [id, at] of Object.entries(store.deletedTemplates)) {
    if (pushed[`t:${id}`] !== -at) templates.push({ tid: id, data: null, updatedAt: at, deleted: true })
  }
  const sessions = store.sessions
    .filter((s) => !pushed[`s:${s.id}`])
    .map((s) => ({ sid: s.id, data: clean(s), startedAt: s.startedAt }))
  const active =
    store.activeAt && pushed.a !== store.activeAt ? { data: clean(store.active), updatedAt: store.activeAt } : undefined
  return { templates, sessions, active }
}

async function push() {
  if (!client || !sync.code) return
  if (pushing) { again = true; return }
  const { templates, sessions, active } = changes()
  if (!templates.length && !sessions.length && !active) {
    if (sync.status !== 'error') sync.status = isOffline() ? 'offline' : 'synced'
    return
  }
  if (isOffline()) { sync.status = 'offline'; return }

  pushing = true
  sync.status = 'syncing'
  const vault = sha256Hex(sync.code)
  try {
    // First upload can include a lot of history; send it in batches.
    for (let i = 0; i < Math.max(sessions.length, 1); i += 100) {
      await client.mutation(api.sync!.push!, {
        vault,
        templates: i === 0 ? templates : [],
        sessions: sessions.slice(i, i + 100),
        active: i === 0 ? active : undefined,
      })
    }
    for (const t of templates) pushed[`t:${t.tid}`] = t.deleted ? -t.updatedAt : t.updatedAt
    for (const s of sessions) pushed[`s:${s.sid}`] = 1
    if (active) pushed.a = active.updatedAt
    savePushed()
    sync.status = 'synced'
    sync.lastSynced = Date.now()
  } catch {
    sync.status = isOffline() ? 'offline' : 'error'
    schedulePush(5000)
  } finally {
    pushing = false
    if (again) { again = false; schedulePush(0) }
  }
}

/** Records that now match the server don't need pushing back (avoids echo). */
function markRemoteAsPushed(remote: RemoteSnapshot) {
  for (const rt of remote.templates) {
    const local = store.templates.find((t) => t.id === rt.tid)
    if (rt.deleted ? !local && store.deletedTemplates[rt.tid] === rt.updatedAt : local?.updatedAt === rt.updatedAt) {
      pushed[`t:${rt.tid}`] = rt.deleted ? -rt.updatedAt : rt.updatedAt
    }
  }
  for (const s of remote.sessions as Session[]) pushed[`s:${s.id}`] = 1
  if (remote.active && remote.active.updatedAt === store.activeAt) pushed.a = store.activeAt
  savePushed()
  sync.lastSynced = Date.now()
  if (sync.status !== 'syncing') sync.status = 'synced'
}
