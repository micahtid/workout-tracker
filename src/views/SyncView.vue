<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronLeft, Copy, Eye, EyeOff } from 'lucide-vue-next'
import { createSync, linkSync, sync, unlinkSync } from '@/sync'
import { generateCode, normalizeCode } from '@/sync/code'

const entered = ref('')
const valid = computed(() => normalizeCode(entered.value))
const show = ref(false)
const copied = ref(false)

const statusText = computed(() => {
  switch (sync.status) {
    case 'synced': return 'Synced'
    case 'syncing': return 'Syncing…'
    case 'offline': return 'Offline · Changes Will Sync Later'
    case 'error': return "Can't Reach Server · Retrying"
    default: return 'Off'
  }
})

const masked = computed(() => (sync.code ?? '').replace(/[A-Z0-9]/g, '•'))

function create() {
  createSync(generateCode())
  show.value = true
}

function link() {
  if (!valid.value) return
  if (!confirm('Link this device? Its workouts will be replaced with the ones synced to this code.')) return
  linkSync(valid.value)
  entered.value = ''
}

async function copy() {
  if (!sync.code) return
  try {
    await navigator.clipboard.writeText(sync.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    show.value = true
  }
}

function unlink() {
  if (!confirm('Stop syncing on this device? Your workouts stay on this device, and other devices keep syncing.')) return
  unlinkSync()
  show.value = false
}
</script>

<template>
  <main>
    <div class="topbar">
      <RouterLink to="/" class="btn-text"><ChevronLeft :size="18" /> Workouts</RouterLink>
    </div>

    <h1>Sync</h1>

    <p v-if="!sync.available" class="muted">Sync isn't configured for this build.</p>

    <!-- Linked -->
    <template v-else-if="sync.code">
      <p class="status">
        <span class="dot" :class="sync.status" aria-hidden="true" />
        {{ statusText }}
      </p>

      <section class="section">
        <p class="label">Your Sync Code</p>
        <div class="code-row">
          <span class="code tabular">{{ show ? sync.code : masked }}</span>
          <button class="icon-btn" :aria-label="show ? 'Hide Code' : 'Show Code'" @click="show = !show">
            <EyeOff v-if="show" :size="18" />
            <Eye v-else :size="18" />
          </button>
          <button class="icon-btn" aria-label="Copy Code" @click="copy">
            <Check v-if="copied" :size="18" />
            <Copy v-else :size="18" />
          </button>
        </div>
        <p class="hint muted">
          Enter this code on your other devices to sync them. Keep it private: anyone with it can see and edit your workouts.
        </p>
      </section>

      <div class="end">
        <button class="btn-danger" @click="unlink">Stop Syncing on This Device</button>
      </div>
    </template>

    <!-- Not linked -->
    <template v-else>
      <p class="muted intro">Keep your workouts in step across your phone and other devices. Everything still works offline.</p>

      <section class="section">
        <p class="label">First Device</p>
        <button class="btn-primary" @click="create">Create Sync Code</button>
      </section>

      <section class="section">
        <p class="label">Already Have a Code?</p>
        <input
          v-model="entered"
          class="code-input tabular"
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          autocapitalize="characters"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          aria-label="Sync Code"
          @keydown.enter="link"
        />
        <button class="btn-primary link" :disabled="!valid" @click="link">Link This Device</button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.intro { margin: 0; line-height: 1.5; }

.status { display: flex; align-items: center; gap: 8px; margin: 0; font-weight: 500; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.dot.synced { background: var(--text); }
.dot.syncing { background: var(--text-2); animation: pulse 1s ease-in-out infinite alternate; }
@keyframes pulse { to { opacity: 0.3; } }

.code-row { display: flex; align-items: center; gap: 4px; padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.code { flex: 1; font-size: 1.05rem; font-weight: 600; letter-spacing: 0.04em; }
.code-row .icon-btn { width: 36px; height: 36px; color: var(--text-2); }
.code-row .icon-btn:last-child { margin-right: -8px; }
.hint { font-size: 0.82rem; line-height: 1.5; margin: 12px 0 0; }

.code-input { height: 48px; text-align: center; letter-spacing: 0.06em; text-transform: uppercase; }
.link { margin-top: 8px; }

.end { display: flex; justify-content: center; margin-top: 48px; }
</style>
