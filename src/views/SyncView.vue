<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronLeft, Copy } from 'lucide-vue-next'
import { createSync, linkSync, sync, unlinkSync } from '@/sync'
import { generateCode, normalizeCode } from '@/sync/code'

const entered = ref('')
const valid = computed(() => normalizeCode(entered.value))
const copied = ref(false)

function link() {
  if (!valid.value) return
  if (!confirm("Replace this device's workouts with the ones on this code?")) return
  linkSync(valid.value)
  entered.value = ''
}

async function copy() {
  if (!sync.code) return
  try {
    await navigator.clipboard.writeText(sync.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {}
}

function unlink() {
  if (!confirm('Stop syncing on this device? Your workouts stay here.')) return
  unlinkSync()
}
</script>

<template>
  <main>
    <div class="topbar">
      <RouterLink to="/" class="btn-text"><ChevronLeft :size="18" /> Workouts</RouterLink>
    </div>

    <h1>Sync</h1>

    <p v-if="!sync.available" class="muted">Sync isn't available.</p>

    <!-- Linked: the code and a way out. -->
    <template v-else-if="sync.code">
      <button class="code tabular" :aria-label="copied ? 'Copied' : 'Copy Code'" @click="copy">
        <span>{{ sync.code }}</span>
        <Check v-if="copied" :size="18" />
        <Copy v-else :size="18" />
      </button>
      <button class="btn-text off" @click="unlink">Stop Syncing</button>
    </template>

    <!-- Not linked: enter a code, or make one. -->
    <template v-else>
      <input
        v-model="entered"
        class="code-input tabular"
        placeholder="Enter Code"
        autocapitalize="characters"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        aria-label="Sync Code"
        @keydown.enter="link"
      />
      <button class="btn-primary" :disabled="!valid" @click="link">Link Device</button>
      <button class="btn-text new" @click="createSync(generateCode())">Or Create a New Code</button>
    </template>
  </main>
</template>

<style scoped>
.code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border-radius: var(--radius);
  background: var(--field);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.code .lucide { color: var(--text-2); }

.off { margin-top: 16px; font-size: 0.85rem; color: var(--muted); }

.code-input { height: 48px; text-align: center; font-size: 1.05rem; letter-spacing: 0.06em; text-transform: uppercase; }
.code-input::placeholder { text-transform: none; letter-spacing: 0; }
.btn-primary { margin-top: 8px; }
.new { display: flex; margin: 16px auto 0; font-size: 0.85rem; }
</style>
