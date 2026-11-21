<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChartLine, ChevronRight, Cloud, CloudOff, Plus } from 'lucide-vue-next'
import { DAYS, useWorkoutStore, type Template } from '@/stores/workouts'
import { relativeDay } from '@/utils/format'
import CalendarHeatmap from '@/components/CalendarHeatmap.vue'
import { sync } from '@/sync/state'

const store = useWorkoutStore()
const router = useRouter()
const today = new Date().getDay()
const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

/** The week, Sunday→Saturday; days with nothing scheduled are rest days. */
const week = computed(() =>
  DAYS.map((name, day) => ({
    day,
    label: name.slice(0, 3),
    templates: store.templates.filter((t) => t.day === day),
  })),
)
const unscheduled = computed(() => store.templates.filter((t) => t.day == null))

const todays = computed(() => week.value[today]!.templates[0] ?? null)
/** On a rest day, the next scheduled workout. */
const nextUp = computed(() => {
  for (let i = 1; i <= 7; i++) {
    const d = week.value[(today + i) % 7]!
    if (d.templates[0]) return { template: d.templates[0], when: i === 1 ? 'Tomorrow' : DAYS[d.day] }
  }
  return null
})

const exerciseCount = (t: Template) => `${t.exercises.length} Exercise${t.exercises.length === 1 ? '' : 's'}`

function lastDone(t: Template) {
  const s = store.sessions.find((x) => x.templateId === t.id)
  return s ? relativeDay(s.startedAt) : null
}

function open(templateId: string) {
  if (store.active) {
    if (store.active.templateId === templateId) return router.push('/session')
    if (!confirm(`Discard your in-progress "${store.active.name}" workout and start a new one?`)) return
  }
  store.startSession(templateId)
  router.push('/session')
}
</script>

<template>
  <main>
    <div class="topbar">
      <span class="date muted">{{ dateLabel }}</span>
      <span class="topbar-actions">
        <RouterLink v-if="sync.available" to="/sync" class="icon-btn" :aria-label="sync.code ? 'Sync: On' : 'Sync: Off'">
          <Cloud v-if="sync.code" :size="18" />
          <CloudOff v-else :size="18" />
        </RouterLink>
        <RouterLink to="/stats" class="icon-btn" aria-label="Progress"><ChartLine :size="18" /></RouterLink>
      </span>
    </div>

    <!-- What to do right now -->
    <section class="today">
      <template v-if="store.active">
        <p class="label">In Progress</p>
        <h1>{{ store.active.name }}</h1>
        <RouterLink to="/session" class="btn-primary">Resume Workout</RouterLink>
      </template>
      <template v-else-if="todays">
        <p class="label">Today</p>
        <h1>{{ todays.name }}</h1>
        <p class="sub muted">{{ todays.note ? `${todays.note} · ` : '' }}{{ exerciseCount(todays) }}</p>
        <button class="btn-primary" @click="open(todays.id)">Start Workout</button>
      </template>
      <template v-else>
        <p class="label">Today</p>
        <h1>Rest Day</h1>
        <p v-if="nextUp" class="sub muted">Next Up: {{ nextUp.template.name }}, {{ nextUp.when }}</p>
      </template>
    </section>

    <section class="section">
      <p class="label">Activity</p>
      <CalendarHeatmap />
    </section>

    <section class="section">
      <p class="label">This Week</p>
      <ul class="rows">
        <template v-for="d in week" :key="d.day">
          <li v-for="t in d.templates" :key="t.id" class="row" :class="{ now: d.day === today }">
            <button class="main" @click="open(t.id)">
              <span class="day">{{ d.label }}</span>
              <span class="text">
                <span class="name">{{ t.name }}</span>
                <span class="muted small">{{ exerciseCount(t) }}<template v-if="lastDone(t)"> · {{ lastDone(t) }}</template></span>
              </span>
            </button>
            <RouterLink :to="`/template/${t.id}`" class="edit">Edit</RouterLink>
          </li>
          <li v-if="!d.templates.length" class="row rest" :class="{ now: d.day === today }">
            <span class="main">
              <span class="day">{{ d.label }}</span>
              <span class="text muted">Rest</span>
            </span>
          </li>
        </template>
      </ul>
    </section>

    <section v-if="unscheduled.length" class="section">
      <p class="label">Other Workouts</p>
      <ul class="rows">
        <li v-for="t in unscheduled" :key="t.id" class="row">
          <button class="main" @click="open(t.id)">
            <span class="text">
              <span class="name">{{ t.name }}</span>
              <span class="muted small">{{ exerciseCount(t) }}<template v-if="lastDone(t)"> · {{ lastDone(t) }}</template></span>
            </span>
            <ChevronRight :size="20" class="muted" />
          </button>
          <RouterLink :to="`/template/${t.id}`" class="edit">Edit</RouterLink>
        </li>
      </ul>
    </section>

    <RouterLink to="/template/new" class="btn-text new"><Plus :size="16" /> New Workout</RouterLink>
  </main>
</template>

<style scoped>
.date { font-size: 0.85rem; font-weight: 500; }

.today { margin-top: 24px; }
.today h1 { margin: 0; font-size: 2rem; }
.today .sub { margin: 6px 0 0; font-size: 0.9rem; }
.today .btn-primary { margin-top: 24px; }

.row { display: flex; align-items: center; min-height: 60px; }
.main { flex: 1; display: flex; align-items: center; gap: 16px; text-align: left; min-width: 0; min-height: 60px; padding: 10px 0; }
.day { width: 32px; flex: none; font-size: 0.85rem; font-weight: 500; color: var(--muted); }
.now .day { color: var(--text); font-weight: 700; }
.text { flex: 1; display: grid; gap: 2px; min-width: 0; }
.name { font-weight: 600; }
.small { font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.edit { padding: 12px 0 12px 16px; font-size: 0.85rem; font-weight: 500; color: var(--muted); }

.new { margin-top: 16px; color: var(--text); }
</style>
