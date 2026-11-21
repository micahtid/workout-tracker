<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWorkoutStore } from '@/stores/workouts'

const store = useWorkoutStore()

const CELL = 11
const GAP = 3
const STEP = CELL + GAP
const TOP = 14 // room for month labels
const DAY = 86_400_000

const el = ref<HTMLElement | null>(null)
const width = ref(340)
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => { if (e) width.value = e.contentRect.width })
  if (el.value) ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Completed sets and workout names per calendar day. */
const byDay = computed(() => {
  const map = new Map<string, { sets: number; names: string[] }>()
  for (const s of store.sessions) {
    const k = keyOf(new Date(s.startedAt))
    const e = map.get(k) ?? { sets: 0, names: [] }
    e.sets += s.exercises.reduce((n, ex) => n + ex.sets.length, 0)
    e.names.push(s.name)
    map.set(k, e)
  }
  return map
})

const weeks = computed(() => Math.max(8, Math.floor((width.value + GAP) / STEP)))

const cells = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Grid ends on this week's Saturday; columns are Sunday→Saturday.
  const start = new Date(today.getTime() - (today.getDay() + (weeks.value - 1) * 7) * DAY)
  const max = Math.max(1, ...[...byDay.value.values()].map((d) => d.sets))
  const out = []
  for (let w = 0; w < weeks.value; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      if (date > today) continue
      const info = byDay.value.get(keyOf(date))
      // 0 = nothing, 1–4 = share of your biggest day.
      const level = info ? Math.max(1, Math.ceil((info.sets / max) * 4)) : 0
      out.push({ x: w * STEP, y: TOP + d * STEP, date, info, level, today: date.getTime() === today.getTime() })
    }
  }
  return out
})

const months = computed(() => {
  const labels: { x: number; text: string }[] = []
  for (const c of cells.value) {
    if (c.date.getDate() !== 1 && c !== cells.value[0]) continue
    // A partial first month gives way if the next label would collide with it.
    if (labels.length && c.x - labels.at(-1)!.x < STEP * 3) labels.pop()
    labels.push({ x: c.x, text: c.date.toLocaleDateString(undefined, { month: 'short' }) })
  }
  return labels
})

const total = computed(() => cells.value.filter((c) => c.info).length)

const picked = ref<number | null>(null)
function pick(e: PointerEvent) {
  const r = (e.currentTarget as SVGElement).getBoundingClientRect()
  const col = Math.floor((e.clientX - r.left) / STEP)
  const row = Math.floor((e.clientY - r.top - TOP) / STEP)
  const i = cells.value.findIndex((c) => c.x === col * STEP && c.y === TOP + row * STEP)
  if (i !== -1) picked.value = i
}

const caption = computed(() => {
  const c = picked.value == null ? null : cells.value[picked.value]
  if (!c) return `${total.value} Workout${total.value === 1 ? '' : 's'} in the Last ${weeks.value} Weeks`
  const day = c.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return c.info ? `${day} · ${c.info.names.join(', ')} · ${c.info.sets} Sets` : `${day} · Rest`
})
</script>

<template>
  <div ref="el" class="heatmap">
    <svg
      :width="weeks * STEP - GAP"
      :height="TOP + 7 * STEP - GAP"
      role="img"
      :aria-label="caption"
      @pointerdown="pick"
      @pointermove="(e) => e.buttons && pick(e)"
    >
      <text v-for="m in months" :key="m.x" :x="m.x" y="9" class="month">{{ m.text }}</text>
      <rect
        v-for="(c, i) in cells"
        :key="i"
        :x="c.x"
        :y="c.y"
        :width="CELL"
        :height="CELL"
        rx="1.5"
        :class="[`l${c.level}`, { today: c.today, picked: picked === i }]"
      />
    </svg>
    <div class="foot">
      <span class="caption">{{ caption }}</span>
    </div>
  </div>
</template>

<style scoped>
.heatmap {
  /* Monochrome ramp: light grey → black (reversed in dark mode). */
  --h0: #f0f0f0;
  --h1: #cfcfcf;
  --h2: #9a9a9a;
  --h3: #5c5c5c;
  --h4: #2b2b2b;
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
}
@media (prefers-color-scheme: dark) {
  .heatmap { --h0: #222222; --h1: #3a3a3a; --h2: #6b6b6b; --h3: #a8a8a8; --h4: #e6e6e6; }
}

svg { display: block; overflow: visible; }
.month { fill: var(--muted); font-size: 10px; font-weight: 500; }

rect { transition: fill 150ms ease-out; }
.l0 { fill: var(--h0); background: var(--h0); }
.l1 { fill: var(--h1); background: var(--h1); }
.l2 { fill: var(--h2); background: var(--h2); }
.l3 { fill: var(--h3); background: var(--h3); }
.l4 { fill: var(--h4); background: var(--h4); }
rect.today { stroke: var(--text); stroke-width: 1; }
rect.picked { stroke: var(--text); stroke-width: 2; }

.foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
.caption { font-size: 0.8rem; font-weight: 500; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
