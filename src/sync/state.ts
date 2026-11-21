/**
 * Sync status shared with the UI. Kept separate from the sync engine so the
 * Convex client only loads when sync is actually turned on.
 */
import { reactive } from 'vue'

export const CODE_KEY = 'wt:sync-code'

export function readLocal(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}
export function writeLocal(key: string, value: string | null) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch {}
}

export const sync = reactive({
  code: readLocal(CODE_KEY),
  status: 'off' as 'off' | 'syncing' | 'synced' | 'offline' | 'error',
  lastSynced: null as number | null,
  available: !!import.meta.env.VITE_CONVEX_URL,
})
