import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'
import router from './router'
import { useWorkoutStore } from './stores/workouts'
import { sync } from './sync/state'
import './assets/main.css'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)
app.use(pinia)
const store = useWorkoutStore(pinia)
store.seedIfEmpty()
store.trackActive()
// Load the sync engine (and Convex client) only when sync is turned on.
if (sync.code) void import('./sync').then((m) => m.initSync(store))
app.use(router)
app.mount('#app')

// Ask the browser not to evict saved data under storage pressure.
navigator.storage?.persist?.()
