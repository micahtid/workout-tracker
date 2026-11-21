<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDownRight, ArrowUpRight, ChevronLeft } from 'lucide-vue-next'
import { useWorkoutStore } from '@/stores/workouts'
import Sparkline from '@/components/Sparkline.vue'
import { UNIT, num } from '@/utils/format'

const store = useWorkoutStore()

const rows = computed(() =>
  [...store.exerciseHistory.entries()]
    .map(([key, { name, points }]) => {
      const first = points[0]!
      const last = points.at(-1)!
      return { key, name, points, latest: last.e1rm, change: last.e1rm - first.e1rm, sessions: points.length }
    })
    .sort((a, b) => b.points.at(-1)!.date - a.points.at(-1)!.date),
)

const weekCount = computed(() => {
  const since = Date.now() - 7 * 86_400_000
  return store.sessions.filter((s) => s.startedAt >= since).length
})
const improving = computed(() => rows.value.filter((r) => r.sessions > 1 && r.change > 0).length)
</script>

<template>
  <main>
    <div class="topbar">
      <RouterLink to="/" class="btn-text"><ChevronLeft :size="18" /> Workouts</RouterLink>
    </div>

    <h1>Progress</h1>

    <template v-if="rows.length">
      <dl class="summary">
        <div><dd class="tabular">{{ store.sessions.length }}</dd><dt>Workouts</dt></div>
        <div><dd class="tabular">{{ weekCount }}</dd><dt>This Week</dt></div>
        <div><dd class="tabular">{{ improving }}/{{ rows.length }}</dd><dt>Improving</dt></div>
      </dl>

      <section class="section">
        <p class="label">Exercises <span>Est. 1-Rep Max, {{ UNIT }}</span></p>
        <ul class="rows">
          <li v-for="r in rows" :key="r.key">
            <RouterLink :to="`/stats/${encodeURIComponent(r.key)}`" class="item">
              <span class="name">
                <span class="title">{{ r.name }}</span>
                <span v-if="r.sessions < 2" class="muted small">1 Session So Far</span>
                <span v-else class="small change tabular" :class="{ down: r.change < 0 }">
                  <ArrowUpRight v-if="r.change > 0" :size="16" />
                  <ArrowDownRight v-else-if="r.change < 0" :size="16" />
                  {{ r.change > 0 ? '+' : '' }}{{ num(r.change) }} {{ UNIT }} Since Start
                </span>
              </span>
              <Sparkline :values="r.points.map((p) => p.e1rm)" />
              <span class="latest tabular">{{ num(r.latest) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>

    <p v-else class="muted">Finish a workout and your progress for each exercise will show up here.</p>
  </main>
</template>

<style scoped>
.summary { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.summary div { display: grid; gap: 4px; padding: 16px 0; }
.summary div + div { border-left: 1px solid var(--line); padding-left: 16px; }
.summary dd { margin: 0; font-size: 1.5rem; font-weight: 600; letter-spacing: -0.03em; }
.summary dt { font-size: 0.8rem; font-weight: 500; color: var(--muted); }

.label span { font-size: 0.75rem; }

.item { display: flex; align-items: center; gap: 16px; padding: 14px 0; }
.name { flex: 1; display: grid; gap: 2px; min-width: 0; }
.title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.small { font-size: 0.82rem; }
.change { display: inline-flex; align-items: center; gap: 2px; color: var(--text-2); }
.change.down { color: var(--muted); }
.latest { min-width: 40px; text-align: right; font-weight: 600; }
</style>
