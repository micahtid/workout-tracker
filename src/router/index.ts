import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const LAST_ROUTE_KEY = 'wt:last-route'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/template/:id', name: 'template', component: () => import('@/views/TemplateView.vue') },
    { path: '/session', name: 'session', component: () => import('@/views/SessionView.vue') },
    { path: '/sync', name: 'sync', component: () => import('@/views/SyncView.vue') },
    { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue') },
    { path: '/stats/:name', name: 'exercise-stats', component: () => import('@/views/ExerciseStatsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

// Reopen the app on the screen it was left on — but never on an editor,
// so the app can't get stuck on "New workout" after being closed there.
const RESTORABLE = /^\/(session|stats)(\/|$)/
let restored = false
router.beforeEach((to) => {
  if (restored) return
  restored = true
  try {
    const last = localStorage.getItem(LAST_ROUTE_KEY)
    if (to.path === '/' && last && RESTORABLE.test(last)) return last
  } catch {}
})
router.afterEach((to) => {
  try { localStorage.setItem(LAST_ROUTE_KEY, to.fullPath) } catch {}
})

export default router
