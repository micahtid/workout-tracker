<script setup lang="ts">
import { computed } from 'vue'
import { Timer } from 'lucide-vue-next'
import { clock } from '@/utils/format'

const props = defineProps<{
  /** Target rest in seconds. */
  duration: number
  /** Start timestamp when running on this exercise, else null. */
  start: number | null
  now: number
}>()
defineEmits<{ toggle: [] }>()

const elapsed = computed(() => (props.start ? (props.now - props.start) / 1000 : 0))
const remaining = computed(() => props.duration - elapsed.value)
const progress = computed(() => (props.start ? Math.min(elapsed.value / props.duration, 1) : 0))
</script>

<template>
  <button
    class="timer tabular"
    :class="{ running: start != null }"
    :style="{ '--p': progress }"
    :aria-label="start ? 'Stop Rest Timer' : `Start ${clock(duration)} Rest Timer`"
    @click="$emit('toggle')"
  >
    <span class="fill" aria-hidden="true" />
    <Timer v-if="!start" :size="16" class="ic" />
    <span class="t">
      <template v-if="!start">{{ clock(duration) }}</template>
      <template v-else>{{ clock(Math.max(0, Math.ceil(remaining))) }}</template>
    </span>
  </button>
</template>

<style scoped>
/* Idle: plain text. Running: solid, with the remaining time as a lighter band.
   When rest ends the session resets it back to idle. */
.timer {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  margin-right: -12px;
  border-radius: var(--radius);
  color: var(--text-2);
  font-weight: 500;
  font-size: 0.9rem;
}
.fill {
  display: none;
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--primary-text) 22%, transparent);
  transform-origin: right;
  transform: scaleX(calc(1 - var(--p)));
  transition: transform 250ms linear;
}
.running { margin-right: 0; background: var(--primary); color: var(--primary-text); }
.running .fill { display: block; }
.ic, .t { position: relative; }
</style>
