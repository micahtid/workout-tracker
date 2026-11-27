export const UNIT = 'lb'

const DAY = 86_400_000

export function relativeDay(ts: number) {
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const days = Math.floor((startOfToday - new Date(ts).setHours(0, 0, 0, 0)) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} Days Ago`
  return shortDate(ts)
}

export function shortDate(ts: number) {
  const d = new Date(ts)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

export const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })
