<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ values: number[] }>()
const W = 72
const H = 28
const P = 4

const geo = computed(() => {
  const v = props.values
  const min = Math.min(...v)
  const max = Math.max(...v)
  const pts = v.map((y, i) => ({
    x: v.length === 1 ? W / 2 : P + (i / (v.length - 1)) * (W - P * 2),
    y: H - P - ((y - min) / (max - min || 1)) * (H - P * 2) - (max === min ? (H - P * 2) / 2 : 0),
  }))
  return { pts, d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '), end: pts.at(-1)! }
})
</script>

<template>
  <svg :width="W" :height="H" aria-hidden="true">
    <path v-if="geo.pts.length > 1" :d="geo.d" />
    <circle :cx="geo.end.x" :cy="geo.end.y" r="3.5" />
  </svg>
</template>

<style scoped>
svg { display: block; overflow: visible; }
path { fill: none; stroke: var(--chart); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
circle { fill: var(--chart); stroke: var(--surface); stroke-width: 2; }
</style>
