<script setup lang="ts">
import { computed, ref, type Directive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowUp, Minus, Plus, X } from 'lucide-vue-next'
import { DAYS, groupSupersets, useWorkoutStore, type Template } from '@/stores/workouts'

const store = useWorkoutStore()
const route = useRoute()
const router = useRouter()

const id = route.params.id as string
const isNew = id === 'new'
const existing = isNew ? undefined : store.getTemplate(id)
if (!isNew && !existing) router.replace('/')

// Edit a copy so "Cancel" leaves the template untouched.
const draft = ref<Template>(existing ? JSON.parse(JSON.stringify(existing)) : store.newTemplate())
if (isNew) draft.value.exercises.push(store.newTemplateExercise())

const knownExercises = computed(() => {
  const names = new Set([...store.exerciseHistory.values()].map((e) => e.name))
  for (const t of store.templates) for (const e of t.exercises) if (e.name.trim()) names.add(e.name.trim())
  return [...names]
})

/** Up to three known names matching what's typed, so names stay consistent for stats. */
const focusedEx = ref<string | null>(null)
function suggestions(name: string) {
  const q = name.trim().toLowerCase()
  if (!q) return []
  return knownExercises.value.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 3)
}
const canSave = computed(() => draft.value.name.trim() && draft.value.exercises.some((e) => e.name.trim()))

/** Position of each exercise within its superset (1, 2…); absent if not in one. */
const ssLabel = computed(() => {
  const map = new Map<number, number>()
  for (const g of groupSupersets(draft.value.exercises)) {
    if (g.length < 2) continue
    g.forEach((i, n) => map.set(i, n + 1))
  }
  return map
})

function move(i: number, dir: -1 | 1) {
  const list = draft.value.exercises
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
}

/** Size a textarea to its content (fallback for browsers without field-sizing). */
const grow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
const vAutogrow: Directive<HTMLTextAreaElement> = {
  mounted: (el) => {
    grow(el)
    el.addEventListener('input', () => grow(el))
  },
  updated: grow,
}

const setDay = (d: number) => (draft.value.day = draft.value.day === d ? null : d)

function save() {
  if (!canSave.value) return
  draft.value.name = draft.value.name.trim()
  draft.value.exercises = draft.value.exercises
    .map((e) => ({ ...e, name: e.name.trim() }))
    .filter((e) => e.name)
  // The last exercise can't superset with nothing.
  const last = draft.value.exercises.at(-1)
  if (last) last.superset = false
  store.saveTemplate(draft.value)
  router.replace('/')
}

function remove() {
  if (!confirm(`Delete "${draft.value.name}"? Your logged history is kept.`)) return
  store.deleteTemplate(draft.value.id)
  router.replace('/')
}
</script>

<template>
  <main>
    <div class="topbar">
      <button class="btn-text" @click="router.replace('/')">Cancel</button>
      <button class="btn-small" :disabled="!canSave" @click="save">Save</button>
    </div>

    <input v-model="draft.name" class="title" placeholder="Workout Name" aria-label="Workout Name" />

    <section class="section">
      <p class="label">Day <span>Optional</span></p>
      <div class="days" role="group" aria-label="Scheduled Day">
        <button
          v-for="(d, i) in DAYS"
          :key="d"
          :class="{ on: draft.day === i }"
          :aria-pressed="draft.day === i"
          :aria-label="d"
          @click="setDay(i)"
        >{{ d.slice(0, 3) }}</button>
      </div>
    </section>

    <section class="section">
      <p class="label">Exercises</p>

      <ul class="rows">
        <li
          v-for="(ex, i) in draft.exercises"
          :key="ex.id"
          class="ex"
          :class="{
            linked: ex.superset && i < draft.exercises.length - 1,
            'linked-prev': draft.exercises[i - 1]?.superset,
            'in-ss': ssLabel.has(i),
          }"
        >
          <p v-if="ssLabel.get(i) === 1" class="ss-note">Superset</p>
          <div class="head">
            <!-- Wraps and grows so long names stay fully visible on narrow phones. -->
            <textarea
              v-model="ex.name"
              v-autogrow
              class="name"
              rows="1"
              placeholder="Exercise Name"
              enterkeyhint="next"
              @keydown.enter.prevent
              @focus="focusedEx = ex.id"
              @blur="focusedEx = null"
            />
            <button class="icon-btn" aria-label="Remove Exercise" @click="draft.exercises.splice(i, 1)"><X :size="20" /></button>
          </div>

          <div v-if="focusedEx === ex.id && suggestions(ex.name).length" class="suggest">
            <!-- mousedown.prevent keeps the field focused so the tap registers. -->
            <button v-for="n in suggestions(ex.name)" :key="n" @mousedown.prevent @click="ex.name = n">{{ n }}</button>
          </div>

          <div class="fields">
            <label>
              <span>Sets</span>
              <span class="stepper">
                <button :disabled="ex.sets <= 1" aria-label="Fewer Sets" @click="ex.sets--"><Minus :size="16" /></button>
                <b class="tabular">{{ ex.sets }}</b>
                <button aria-label="More Sets" @click="ex.sets++"><Plus :size="16" /></button>
              </span>
            </label>
            <label>
              <span>Reps</span>
              <input v-model="ex.reps" class="reps" placeholder="8–10" />
            </label>
          </div>

          <div class="foot">
            <span class="order">
              <button :disabled="i === 0" aria-label="Move Up" @click="move(i, -1)"><ArrowUp :size="16" /></button>
              <button :disabled="i === draft.exercises.length - 1" aria-label="Move Down" @click="move(i, 1)"><ArrowDown :size="16" /></button>
            </span>
            <button
              v-if="draft.exercises[i - 1]?.superset"
              class="link"
              @click="draft.exercises[i - 1]!.superset = false"
            >Unlink Superset</button>
            <button
              v-else-if="!ex.superset && i < draft.exercises.length - 1"
              class="link"
              @click="ex.superset = true"
            >Superset With Next</button>
          </div>
        </li>
      </ul>

      <button class="btn-text add" @click="draft.exercises.push(store.newTemplateExercise())">
        <Plus :size="16" /> Add Exercise
      </button>
    </section>

    <div v-if="!isNew" class="end">
      <button class="btn-danger" @click="remove">Delete Workout</button>
    </div>
  </main>
</template>

<style scoped>
.title {
  margin: 16px 0 0;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.035em;
}
.label span { font-size: 0.75rem; }

/* Segmented control. */
.days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; padding: 2px; background: var(--field); border-radius: var(--radius); }
.days button { height: 38px; border-radius: 4px; font-size: 0.82rem; font-weight: 500; color: var(--text-2); }
.days button.on { background: var(--primary); color: var(--primary-text); }

.ex { --input-bg: var(--field); display: grid; gap: 12px; padding: 16px 0; }
/* Superset partners share one soft grey panel, like on the workout screen. */
.ex.in-ss { --input-bg: var(--field); background: var(--tint); margin: 0 -12px; padding: 16px 12px; border-bottom-color: transparent; }
.ex.in-ss.linked { border-radius: var(--radius) var(--radius) 0 0; padding-bottom: 8px; }
.ex.in-ss.linked-prev { border-radius: 0 0 var(--radius) var(--radius); border-top: 1px solid color-mix(in srgb, var(--line), var(--text) 6%); margin-bottom: 8px; }
.ex.in-ss.linked.linked-prev { border-radius: 0; margin-bottom: 0; }
.ex.in-ss + .ex:not(.in-ss) { border-top: 0; }
.ex:has(+ .ex.in-ss):not(.in-ss) { border-bottom-color: transparent; }
.ss-note { font-size: 0.75rem; font-weight: 600; margin: 0 0 -4px; }

.head { display: flex; align-items: center; gap: 8px; }
.name { flex: 1; min-width: 0; padding: 6px 0; background: none; border: 0; border-radius: 0; outline: none; resize: none; overflow: hidden; field-sizing: content; font: inherit; font-size: 16px; font-weight: 600; line-height: 1.35; color: inherit; }
.name:focus { background: none; }

.suggest { display: flex; flex-wrap: wrap; gap: 6px; margin-top: -4px; }
.suggest button { padding: 6px 10px; border-radius: var(--radius); background: var(--input-bg); font-size: 0.82rem; color: var(--text-2); }

.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fields label { display: grid; gap: 6px; }
.fields label > span:first-child { font-size: 0.75rem; font-weight: 500; color: var(--muted); }
.stepper { display: flex; align-items: center; justify-content: space-between; height: 40px; background: var(--input-bg); border-radius: var(--radius); }
.stepper button { width: 32px; height: 40px; display: grid; place-items: center; color: var(--text-2); }
.stepper b { font-weight: 500; }
.reps { height: 40px; padding: 0 6px; text-align: center; background: var(--input-bg); }

.foot { display: flex; align-items: center; justify-content: space-between; }
.order { display: flex; margin-left: -10px; }
.order button { width: 36px; height: 32px; display: grid; place-items: center; color: var(--muted); }
.link { font-size: 0.82rem; font-weight: 500; color: var(--text-2); padding: 6px 0; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--line); }

.add { margin-top: 12px; color: var(--text); }
.end { display: flex; justify-content: center; margin-top: 48px; }
</style>
