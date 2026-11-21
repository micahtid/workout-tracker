<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkoutStore, type ExercisePoint } from '@/stores/workouts'
import { ArrowDownRight, ArrowUpRight, ChevronLeft } from 'lucide-vue-next'
import LineChart from '@/components/LineChart.vue'
import { UNIT, num, shortDate } from '@/utils/format'

const store = useWorkoutStore()
const route = useRoute()
const router = useRouter()

const entry = computed(() => store.exerciseHistory.get(route.params.name as string))
if (!entry.value) router.replace('/stats')

const metrics = [
  { key: 'e1rm', label: 'Est. 1RM', unit: UNIT },
  { key: 'topWeight', label: 'Top Weight', unit: UNIT },
  { key: 'volume', label: 'Volume', unit: UNIT },
] as const
const metric = ref<(typeof metrics)[number]>(metrics[0])

const points = computed(() => entry.value?.points ?? [])
const series = computed(() => points.value.map((p) => ({ x: p.date, y: p[metric.value.key as keyof ExercisePoint] })))
const best = computed(() => Math.max(...series.value.map((p) => p.y)))
const change = computed(() => (series.value.length > 1 ? series.value.at(-1)!.y - series.value[0]!.y : 0))
const fmt = (y: number) => num(y)
const showAll = ref(false)
const allRecent = computed(() => [...points.value].reverse())
const recent = computed(() => (showAll.value ? allRecent.value : allRecent.value.slice(0, 8)))
</script>

<template>
  <main v-if="entry">
    <div class="topbar">
      <RouterLink to="/stats" class="btn-text"><ChevronLeft :size="18" /> Progress</RouterLink>
    </div>

    <h1>{{ entry.name }}</h1>

    <dl class="hero">
      <div>
        <dt>Best {{ metric.label }}</dt>
        <dd class="tabular">{{ num(best) }}<small>{{ metric.unit }}</small></dd>
      </div>
      <div v-if="series.length > 1">
        <dt>Since First Session</dt>
        <dd class="tabular change">
          <ArrowUpRight v-if="change > 0" :size="22" />
          <ArrowDownRight v-else-if="change < 0" :size="22" />
          {{ change > 0 ? '+' : '' }}{{ num(change) }}<small>{{ metric.unit }}</small>
        </dd>
      </div>
    </dl>

    <div class="tabs" role="tablist">
      <button
        v-for="m in metrics"
        :key="m.key"
        role="tab"
        :aria-selected="metric.key === m.key"
        :class="{ on: metric.key === m.key }"
        @click="metric = m"
      >{{ m.label }}</button>
    </div>
    <LineChart :points="series" :format="fmt" />

    <section class="section">
      <p class="label">History</p>
      <table>
        <thead>
          <tr><th>Date</th><th>Best Set</th><th>Est. 1RM</th><th>Volume</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in recent" :key="p.date">
            <td>{{ shortDate(p.date) }}</td>
            <td class="tabular">{{ num(p.topWeight) }} × {{ p.topReps }}</td>
            <td class="tabular">{{ num(p.e1rm) }}</td>
            <td class="tabular">{{ num(p.volume) }}</td>
          </tr>
        </tbody>
      </table>
      <button v-if="allRecent.length > 8" class="btn-text more" @click="showAll = !showAll">
        {{ showAll ? 'Show Less' : `Show All ${allRecent.length} Sessions` }}
      </button>
    </section>
  </main>
</template>

<style scoped>
h1 { margin-bottom: 24px; }

.hero { display: flex; gap: 40px; margin: 0 0 32px; }
.hero div { display: grid; gap: 4px; }
.hero dt { font-size: 0.8rem; font-weight: 500; color: var(--muted); }
.hero dd { margin: 0; display: inline-flex; align-items: center; gap: 4px; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.03em; }
.hero small { font-size: 0.85rem; font-weight: 500; color: var(--muted); margin-left: 4px; letter-spacing: 0; }

/* Text tabs with an underline for the active one. */
.tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--line); margin-bottom: 20px; }
.tabs button { padding: 10px 0; margin-bottom: -1px; border-bottom: 1px solid transparent; font-size: 0.88rem; font-weight: 500; color: var(--muted); }
.tabs button.on { color: var(--text); border-bottom-color: var(--text); }

table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { text-align: left; font-size: 0.75rem; font-weight: 500; color: var(--muted); padding: 0 0 8px; border-bottom: 1px solid var(--line); }
td { padding: 12px 0; border-bottom: 1px solid var(--line); }
th:not(:first-child), td:not(:first-child) { text-align: right; }
.more { margin-top: 8px; }
</style>
