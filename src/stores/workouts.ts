import { defineStore } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { RENAMES, seedTemplates } from './seed'
import { uid } from '@/utils/uid'

/** A reusable workout plan. */
export interface Template {
  id: string
  name: string
  /** e.g. "Hypertrophy" or "Heavy / Strength". */
  note?: string
  /** Day of week it's scheduled on, 0 = Sunday. null = unscheduled. */
  day: number | null
  exercises: TemplateExercise[]
  /** Last edit time; newer edits win when syncing between devices. */
  updatedAt?: number
}

export interface TemplateExercise {
  id: string
  name: string
  sets: number
  /** Shown when the set count is a range, e.g. "2–3". */
  setsNote?: string
  /** Target rep range, e.g. "8–10". */
  reps: string
  /** Superset with the next exercise in the list. */
  superset: boolean
  optional?: boolean
}

export interface SetEntry {
  weight: number | null
  reps: number | null
  done: boolean
}

export interface SessionExercise {
  name: string
  target: string
  superset: boolean
  optional?: boolean
  sets: SetEntry[]
}

/** One performed workout, started from a template. */
export interface Session {
  id: string
  templateId: string
  name: string
  startedAt: number
  finishedAt: number | null
  exercises: SessionExercise[]
}

/** What the server returns for a sync code (see convex/sync.ts → pull). */
export interface RemoteSnapshot {
  templates: { tid: string; data: Template | null; updatedAt: number; deleted: boolean }[]
  sessions: Session[]
  active: { data: Session | null; updatedAt: number } | null
}

export interface ExercisePoint {
  date: number
  topWeight: number
  topReps: number
  e1rm: number
  volume: number
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const exerciseKey = (name: string) => name.trim().toLowerCase()
/** Epley estimated one-rep max — one number that rewards both more weight and more reps. */
export const e1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30))

/** Group exercise indices so a superset chain shares one group. */
export function groupSupersets<T extends { superset: boolean }>(list: T[]): number[][] {
  const groups: number[][] = []
  let current: number[] = []
  list.forEach((ex, i) => {
    current.push(i)
    if (!ex.superset || i === list.length - 1) {
      groups.push(current)
      current = []
    }
  })
  return groups
}

// Saved to localStorage on every change: closing the app, switching apps or
// the OS killing the tab never loses anything — including a workout in progress.
export const useWorkoutStore = defineStore(
  'workouts',
  () => {
    const templates = ref<Template[]>([])
    const sessions = ref<Session[]>([]) // finished, newest first
    const active = ref<Session | null>(null)
    const seeded = ref(false)

    // ---- Sync bookkeeping ----
    /** Deleted template ids → deletion time, so deletions reach other devices. */
    const deletedTemplates = ref<Record<string, number>>({})
    /** Last time the in-progress workout changed on this device. */
    const activeAt = ref(0)
    let applyingRemote = false
    /** Start stamping local edits to the active workout. Called after saved
     *  data has loaded, so restoring it at startup doesn't count as an edit. */
    function trackActive() {
      watch(active, () => { if (!applyingRemote) activeAt.value = Date.now() }, { deep: true })
    }

    /** Apply exercise renames to everything already saved (safe to run every launch). */
    function migrateNames() {
      const fix = (x: { name: string }) => { const n = RENAMES[x.name]; if (n) x.name = n }
      templates.value.forEach((t) => t.exercises.forEach(fix))
      sessions.value.forEach((s) => s.exercises.forEach(fix))
      active.value?.exercises.forEach(fix)
    }

    /** Load the starter program once, on first launch. */
    function seedIfEmpty() {
      migrateNames()
      if (seeded.value) return
      seeded.value = true
      if (!templates.value.length) templates.value = seedTemplates()
    }

    const getTemplate = (id: string) => templates.value.find((t) => t.id === id)

    function saveTemplate(t: Template) {
      t.updatedAt = Date.now()
      delete deletedTemplates.value[t.id]
      const i = templates.value.findIndex((x) => x.id === t.id)
      if (i === -1) templates.value.push(t)
      else templates.value[i] = t
    }

    function deleteTemplate(id: string) {
      templates.value = templates.value.filter((t) => t.id !== id)
      deletedTemplates.value[id] = Date.now()
    }

    /** Linking this device to an existing sync code: drop local data and take the synced copy. */
    function resetForLink() {
      applyingRemote = true
      templates.value = []
      sessions.value = []
      active.value = null
      deletedTemplates.value = {}
      activeAt.value = 0
      seeded.value = true
      nextTick(() => (applyingRemote = false))
    }

    /**
     * Merge data from the server. Templates and the active workout: newest edit
     * wins. Sessions: union (they're never edited once logged).
     */
    async function applyRemote(remote: RemoteSnapshot) {
      applyingRemote = true
      for (const rt of remote.templates) {
        const i = templates.value.findIndex((t) => t.id === rt.tid)
        const local = templates.value[i]
        const localAt = local?.updatedAt ?? 0
        if (rt.deleted) {
          if (local && rt.updatedAt >= localAt) templates.value.splice(i, 1)
          if (!local || rt.updatedAt >= localAt) deletedTemplates.value[rt.tid] = rt.updatedAt
        } else if (local ? rt.updatedAt > localAt : (deletedTemplates.value[rt.tid] ?? 0) < rt.updatedAt) {
          const t = { ...rt.data, updatedAt: rt.updatedAt } as Template
          if (local) templates.value[i] = t
          else templates.value.push(t)
          delete deletedTemplates.value[rt.tid]
        }
      }

      const have = new Set(sessions.value.map((s) => s.id))
      const added = remote.sessions.filter((s) => !have.has(s.id))
      if (added.length) sessions.value = [...sessions.value, ...added].sort((a, b) => b.startedAt - a.startedAt)

      if (remote.active && remote.active.updatedAt > activeAt.value) {
        active.value = remote.active.data
        activeAt.value = remote.active.updatedAt
      }
      // Finished on another device.
      if (active.value && sessions.value.some((s) => s.id === active.value!.id)) active.value = null

      await nextTick()
      applyingRemote = false
    }

    function newTemplate(): Template {
      return { id: uid(), name: '', day: null, exercises: [] }
    }

    function newTemplateExercise(name = ''): TemplateExercise {
      return { id: uid(), name, sets: 3, reps: '', superset: false }
    }

    /** Last finished sets for an exercise — same workout first, else any workout.
     *  (Heavy and hypertrophy days of the same lift compare against themselves.) */
    function previousSets(name: string, templateId?: string): SetEntry[] | null {
      const key = exerciseKey(name)
      const find = (sameTemplate: boolean) => {
        for (const s of sessions.value) {
          if (sameTemplate && s.templateId !== templateId) continue
          const ex = s.exercises.find((e) => exerciseKey(e.name) === key)
          if (ex?.sets.length) return ex.sets
        }
        return null
      }
      return (templateId && find(true)) || find(false)
    }

    function startSession(templateId: string) {
      const t = getTemplate(templateId)
      if (!t) return
      active.value = {
        id: uid(),
        templateId: t.id,
        name: t.name,
        startedAt: Date.now(),
        finishedAt: null,
        // Weight is pre-filled from last time; reps start empty, with last
        // time's reps at that weight shown in the corner of the reps box.
        exercises: t.exercises.map((ex) => {
          const prev = previousSets(ex.name, t.id)
          return {
            name: ex.name,
            target: ex.reps ?? '',
            superset: !!ex.superset,
            optional: ex.optional,
            sets: Array.from({ length: Math.max(ex.sets, 1) }, (_, i) => ({
              weight: (prev?.[i] ?? prev?.at(-1))?.weight ?? null,
              reps: null,
              done: false,
            })),
          }
        }),
      }
    }

    function finishSession() {
      const s = active.value
      if (!s) return
      // Keep only completed sets; drop exercises that had none.
      const exercises = s.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done && x.weight != null && x.reps) }))
        .filter((e) => e.sets.length)
      if (exercises.length) sessions.value.unshift({ ...s, exercises, finishedAt: Date.now() })
      active.value = null
    }

    function discardSession() {
      active.value = null
    }

    /** Every exercise ever logged, keyed by normalized name. */
    const exerciseHistory = computed(() => {
      const map = new Map<string, { name: string; points: ExercisePoint[] }>()
      for (const s of [...sessions.value].reverse()) {
        for (const ex of s.exercises) {
          const key = exerciseKey(ex.name)
          let best: SetEntry | null = null
          let volume = 0
          for (const set of ex.sets) {
            const w = set.weight ?? 0
            const r = set.reps ?? 0
            volume += w * r
            if (!best || e1rm(w, r) > e1rm(best.weight ?? 0, best.reps ?? 0)) best = set
          }
          if (!best) continue
          const entry = map.get(key) ?? { name: ex.name, points: [] }
          entry.name = ex.name
          entry.points.push({
            date: s.startedAt,
            topWeight: best.weight ?? 0,
            topReps: best.reps ?? 0,
            e1rm: Math.round(e1rm(best.weight ?? 0, best.reps ?? 0)),
            volume,
          })
          map.set(key, entry)
        }
      }
      return map
    })

    return {
      templates, sessions, active, seeded, deletedTemplates, activeAt, exerciseHistory,
      seedIfEmpty, trackActive, resetForLink, applyRemote, getTemplate, saveTemplate, deleteTemplate, newTemplate, newTemplateExercise,
      previousSets, startSession, finishSession, discardSession,
    }
  },
  { persist: true },
)
