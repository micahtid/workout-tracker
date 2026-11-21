<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { shortDate } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    points: { x: number; y: number }[]
    format?: (y: number) => string
    height?: number
  }>(),
  { format: (y: number) => y.toLocaleString(), height: 200 },
)

const el = ref<HTMLElement | null>(null)
const width = ref(320)
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => { if (e) width.value = e.contentRect.width })
  if (el.value) ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())

const pad = { top: 12, right: 12, bottom: 24, left: 44 }

/** Clean, round tick values spanning the data. */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) { min = min * 0.9; max = max * 1.1 || 1 }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6))
  return ticks
}

const ticks = computed(() => {
  const ys = props.points.map((p) => p.y)
  return niceTicks(Math.min(...ys), Math.max(...ys))
})

const geo = computed(() => {
  const w = width.value
  const h = props.height
  const t = ticks.value
  const yMin = t[0]!
  const yMax = t.at(-1)!
  const n = props.points.length
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  // Sessions are evenly spaced: the story is session-to-session progress.
  const x = (i: number) => pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH
  const pts = props.points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.y) }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx},${p.cy}`).join(' ')
  const base = pad.top + innerH
  const area = pts.length > 1 ? `${line} L${pts.at(-1)!.cx},${base} L${pts[0]!.cx},${base} Z` : ''
  return { w, h, pts, line, area, y, base }
})

const hover = ref<number | null>(null)
function onPointer(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const px = e.clientX - rect.left
  let best = 0
  geo.value.pts.forEach((p, i) => { if (Math.abs(p.cx - px) < Math.abs(geo.value.pts[best]!.cx - px)) best = i })
  hover.value = best
}

const active = computed(() => (hover.value == null ? geo.value.pts.at(-1) : geo.value.pts[hover.value]))
</script>

<template>
  <div ref="el" class="chart">
    <svg
      :width="geo.w"
      :height="geo.h"
      role="img"
      aria-label="Progress over time"
      @pointermove="onPointer"
      @pointerdown="onPointer"
      @pointerleave="hover = null"
    >
      <g class="grid">
        <g v-for="t in ticks" :key="t">
          <line :x1="44" :x2="geo.w - 12" :y1="geo.y(t)" :y2="geo.y(t)" />
          <text :x="36" :y="geo.y(t)" dy="0.32em" text-anchor="end">{{ format(t) }}</text>
        </g>
      </g>

      <path v-if="geo.area" :d="geo.area" class="area" />
      <path v-if="geo.pts.length > 1" :d="geo.line" class="line" />

      <line
        v-if="hover != null && active"
        class="crosshair"
        :x1="active.cx" :x2="active.cx" :y1="12" :y2="geo.base"
      />
      <circle v-if="active" :cx="active.cx" :cy="active.cy" r="5" class="dot" />

      <text v-if="geo.pts.length" class="xlabel" :x="geo.pts[0]!.cx" :y="geo.h - 4" text-anchor="start">
        {{ shortDate(geo.pts[0]!.x) }}
      </text>
      <text v-if="geo.pts.length > 1" class="xlabel" :x="geo.pts.at(-1)!.cx" :y="geo.h - 4" text-anchor="end">
        {{ shortDate(geo.pts.at(-1)!.x) }}
      </text>
    </svg>

    <div
      v-if="hover != null && active"
      class="tip"
      :style="{ left: `${Math.min(Math.max(active.cx, 60), geo.w - 60)}px`, top: `${active.cy}px` }"
    >
      <strong class="tabular">{{ format(active.y) }}</strong>
      <span>{{ shortDate(active.x) }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart { position: relative; width: 100%; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
svg { display: block; overflow: visible; }
.grid line { stroke: var(--line); stroke-width: 1; }
.grid text, .xlabel { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.line { fill: none; stroke: var(--chart); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.area { fill: var(--chart); opacity: 0.1; }
.crosshair { stroke: var(--muted); stroke-width: 1; }
.dot { fill: var(--chart); stroke: var(--surface); stroke-width: 2; }
.tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  display: grid;
  gap: 2px;
  padding: 6px 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  font-size: 0.8rem;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}
.tip span { color: var(--muted); }
</style>
