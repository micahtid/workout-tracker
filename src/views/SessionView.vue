<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowUp, Check, ChevronLeft, Volume2, VolumeX } from 'lucide-vue-next'
import { e1rm, groupSupersets, useWorkoutStore, type SetEntry } from '@/stores/workouts'
import RestTimer from '@/components/RestTimer.vue'
import { relativeDay } from '@/utils/format'
import { playChime, primeChime } from '@/utils/chime'

const store = useWorkoutStore()
const router = useRouter()

if (!store.active) router.replace('/')

const groups = computed(() => groupSupersets(store.active?.exercises ?? []))

// Last time's sets for each exercise (same workout first, else any).
const previous = computed(
  () => store.active?.exercises.map((ex) => store.previousSets(ex.name, store.active!.templateId)) ?? [],
)
const lastDate = computed(() => {
  const s = store.sessions.find((x) => x.templateId === store.active?.templateId)
  return s ? relativeDay(s.startedAt) : null
})

const prevFor = (ei: number, si: number) => previous.value[ei]?.[si] ?? previous.value[ei]?.at(-1) ?? null

/**
 * Last time's reps *at the weight currently entered*: the same set if the
 * weight matches, otherwise the best set last time at that weight. Null when
 * that weight wasn't used last time.
 */
function lastReps(ei: number, si: number, weight: number | null) {
  if (weight == null) return null
  const same = prevFor(ei, si)
  if (same?.weight === weight && same.reps) return same.reps
  const atWeight = (previous.value[ei] ?? []).filter((s) => s.weight === weight && s.reps)
  return atWeight.length ? Math.max(...atWeight.map((s) => s.reps!)) : null
}

/** Did this (completed) set beat the same set last time? */
function improved(ei: number, si: number, set: SetEntry) {
  const p = prevFor(ei, si)
  if (!set.done || !p || set.weight == null || !set.reps || p.weight == null || !p.reps) return false
  return e1rm(set.weight, set.reps) > e1rm(p.weight, p.reps)
}

/**
 * Ticking a set: empty reps take last time's reps at that weight (the corner
 * number), so repeating last session is one tap. Also starts that exercise's
 * rest timer.
 */
function toggle(ei: number, si: number, set: SetEntry) {
  if (set.done) {
    set.done = false
    return
  }
  set.reps ??= lastReps(ei, si, set.weight)
  if (set.weight == null || !set.reps) {
    document.getElementById(`${set.weight == null ? 'w' : 'r'}-${ei}-${si}`)?.focus()
    return
  }
  set.done = true
  primeChime()
  navigator.vibrate?.(10)
  store.startTimer(ei)
}

function toggleTimer(ei: number) {
  primeChime()
  if (store.active?.timer?.ex === ei) store.stopTimer()
  else store.startTimer(ei)
}

// Clock for the rest timer; the start time is saved, so it survives closing the app.
const now = ref(Date.now())
let tick: number | undefined
watch(
  () => store.active?.timer,
  (t) => {
    clearInterval(tick)
    if (t) tick = window.setInterval(() => (now.value = Date.now()), 250)
    now.value = Date.now()
  },
  { immediate: true },
)
// When rest is over: chime + buzz, then the timer resets to its idle button.
// If it ran out while the app was closed or in the background (the clock
// jumped instead of ticking), it just resets quietly — no late chime.
const expired = () => {
  const t = store.active?.timer
  const ex = t && store.active?.exercises[t.ex]
  return !!(t && ex && Date.now() - t.start >= ex.rest * 1000)
}
if (expired()) store.stopTimer()
let lastTick = Date.now()
watch(now, (n) => {
  const resumed = n - lastTick > 2000
  lastTick = n
  if (!expired()) return
  store.stopTimer()
  if (resumed) return
  navigator.vibrate?.([200, 100, 200])
  if (store.sound) playChime()
})

const totalSets = computed(() => store.active?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0)
const doneCount = computed(() => store.active?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) ?? 0)

function finish() {
  if (!doneCount.value && !confirm('No sets are checked off. Finish without saving anything?')) return
  store.finishSession()
  router.replace('/')
}

function discard() {
  if (!confirm('Discard this workout?')) return
  store.discardSession()
  router.replace('/')
}

// Keep the screen awake during a workout so the timer stays visible.
let wakeLock: WakeLockSentinel | null = null
const lock = async () => {
  try { if (document.visibilityState === 'visible') wakeLock = await navigator.wakeLock?.request('screen') } catch {}
}
// Everything is already saved, but warn if a manual reload/close is attempted mid-workout.
const warn = (e: BeforeUnloadEvent) => { if (store.active) e.preventDefault() }
onMounted(() => {
  lock()
  document.addEventListener('visibilitychange', lock)
  window.addEventListener('beforeunload', warn)
})
onBeforeUnmount(() => {
  clearInterval(tick)
  wakeLock?.release()
  document.removeEventListener('visibilitychange', lock)
  window.removeEventListener('beforeunload', warn)
})
</script>

<template>
  <main v-if="store.active">
    <div class="topbar">
      <RouterLink to="/" class="btn-text"><ChevronLeft :size="18" /> Workouts</RouterLink>
      <span class="topbar-actions">
        <button
          class="icon-btn"
          :aria-label="store.sound ? 'Mute Timer Sound' : 'Unmute Timer Sound'"
          :aria-pressed="store.sound"
          @click="store.sound = !store.sound; store.sound && primeChime()"
        >
          <Volume2 v-if="store.sound" :size="18" />
          <VolumeX v-else :size="18" />
        </button>
        <button class="btn-small" @click="finish">Finish</button>
      </span>
    </div>

    <h1>{{ store.active.name }}</h1>

    <div class="progress">
      <span class="tabular">{{ doneCount }} of {{ totalSets }} Sets</span>
      <span v-if="lastDate" class="muted">Last Done {{ lastDate }}</span>
      <div class="bar"><span :style="{ transform: `scaleX(${totalSets ? doneCount / totalSets : 0})` }" /></div>
    </div>

    <div v-for="(group, gi) in groups" :key="gi" class="group" :class="{ superset: group.length > 1 }">
      <p v-if="group.length > 1" class="ss-head">
        <span>Superset</span>
        <span class="muted">{{ Math.max(...group.map((i) => store.active!.exercises[i]!.sets.length)) }} Rounds · Alternate</span>
      </p>
      <section v-for="ei in group" :key="ei" class="exercise">
        <template v-for="ex in [store.active.exercises[ei]!]" :key="ei">
          <header>
            <div class="title">
              <h2>{{ ex.name }}</h2>
              <span class="meta muted">
                {{ ex.sets.length }} × {{ ex.target || '—' }}<template v-if="ex.optional"> · Optional</template>
              </span>
            </div>
            <RestTimer
              :duration="ex.rest"
              :start="store.active.timer?.ex === ei ? store.active.timer.start : null"
              :now="now"
              @toggle="toggleTimer(ei)"
            />
          </header>

          <div class="grid cols" aria-hidden="true">
            <span>Set</span><span>Weight</span><span>Reps</span><span />
          </div>

          <div v-for="(set, si) in ex.sets" :key="si" class="grid row" :class="{ done: set.done }">
            <span class="n tabular">
              <ArrowUp v-if="improved(ei, si, set)" :size="16" aria-label="Better Than Last Time" />
              <template v-else>{{ si + 1 }}</template>
            </span>
            <input
              :id="`w-${ei}-${si}`"
              v-model.number="set.weight"
              type="number"
              inputmode="decimal"
              step="any"
              class="tabular"
              placeholder="lb"
              :aria-label="`${ex.name} Set ${si + 1} Weight`"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <span class="reps-cell">
              <input
                :id="`r-${ei}-${si}`"
                v-model.number="set.reps"
                type="number"
                inputmode="numeric"
                class="tabular"
                :aria-label="`${ex.name} Set ${si + 1} Reps${lastReps(ei, si, set.weight) ? `, Last Time ${lastReps(ei, si, set.weight)}` : ''}`"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <span v-if="!set.done && lastReps(ei, si, set.weight)" class="last tabular" aria-hidden="true">
                Last {{ lastReps(ei, si, set.weight) }}
              </span>
            </span>
            <button class="check" :aria-pressed="set.done" :aria-label="`Complete Set ${si + 1}`" @click="toggle(ei, si, set)">
              <Check :size="18" />
            </button>
          </div>
        </template>
      </section>
    </div>

    <p v-if="!store.active.exercises.length" class="muted">
      This workout has no exercises.
      <RouterLink :to="`/template/${store.active.templateId}`" class="btn-text">Edit Workout</RouterLink>
    </p>

    <div class="end">
      <button class="btn-danger" @click="discard">Discard Workout</button>
    </div>
  </main>
</template>

<style scoped>
h1 { margin-bottom: 16px; }

.progress { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 0.85rem; font-weight: 500; margin-bottom: 8px; }
.bar { flex-basis: 100%; height: 2px; background: var(--line); }
.bar span { display: block; height: 100%; background: var(--text); transform-origin: left; transition: transform 300ms ease-out; }

/* Groups are separated by hairlines. A superset is a soft grey panel holding
   its exercises (A1, A2…) so the pairing reads at a glance. */
.group { --group-bg: var(--bg); --input-bg: var(--field); border-bottom: 1px solid var(--line); padding: 8px 0 20px; }
.group.superset {
  --group-bg: var(--tint);
  --input-bg: var(--field);
  margin: 16px -12px;
  padding: 14px 12px 16px;
  border-bottom: 0;
  border-radius: var(--radius);
  background: var(--group-bg);
}
.group.superset + .group:not(.superset) { padding-top: 8px; }
.ss-head { display: flex; justify-content: space-between; margin: 0; font-size: 0.8rem; font-weight: 600; }
.ss-head .muted { font-weight: 500; }
.exercise + .exercise { margin-top: 8px; }
.superset .exercise + .exercise { border-top: 1px solid color-mix(in srgb, var(--line), var(--text) 6%); margin-top: 12px; }

/* Header with the rest timer stays visible while you scroll the exercise. */
header {
  position: sticky;
  top: var(--safe-top);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0 12px;
  background: var(--group-bg);
}
.title { flex: 1; min-width: 0; display: grid; gap: 2px; }
h2 { font-size: 1rem; font-weight: 600; margin: 0; line-height: 1.3; }
.meta { font-size: 0.82rem; }

.grid { display: grid; grid-template-columns: 28px 1fr 1fr 44px; gap: 8px; align-items: center; }
.cols { font-size: 0.75rem; font-weight: 500; color: var(--muted); margin-bottom: 6px; }
.cols span:nth-child(2), .cols span:nth-child(3) { text-align: center; }

.row + .row { margin-top: 6px; }
.n { display: grid; place-items: center; color: var(--muted); font-size: 0.85rem; font-weight: 500; }
.row.done .n { color: var(--text); }

.row input { height: 44px; text-align: center; font-weight: 500; background: var(--input-bg); }
/* Last time's reps at this weight, tucked into the top-right of the reps box. */
.reps-cell { position: relative; display: block; }
.last { position: absolute; top: 4px; right: 7px; font-size: 0.62rem; font-weight: 500; color: var(--muted); pointer-events: none; }
.row.done input { background: transparent; font-weight: 600; }

.check {
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--input-bg);
  color: var(--muted);
}
.row.done .check { background: var(--primary); color: var(--primary-text); }

.end { display: flex; justify-content: center; margin-top: 32px; }
</style>
