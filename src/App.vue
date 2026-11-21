<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

// New versions install in the background; the page only reloads when you tap.
const { needRefresh, updateServiceWorker } = useRegisterSW()
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>

  <div v-if="needRefresh" class="toast">
    <span>Update Available</span>
    <button class="btn-text" @click="needRefresh = false">Later</button>
    <button class="reload" @click="updateServiceWorker(true)">Reload</button>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 120ms ease-out; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.toast {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--safe-bottom) + 16px);
  max-width: 528px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.toast span { flex: 1; }
.reload { padding: 8px 14px; border-radius: var(--radius); background: var(--primary); color: var(--primary-text); font-weight: 600; }
</style>
