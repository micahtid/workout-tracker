import type { Template, TemplateExercise } from './workouts'
import { uid } from '@/utils/uid'

type Row = [name: string, sets: number | [min: number, max: number], reps: string, opts?: { optional?: boolean }]

const ex = ([name, sets, reps, opts]: Row): TemplateExercise => ({
  id: uid(),
  name,
  sets: Array.isArray(sets) ? sets[1] : sets,
  setsNote: Array.isArray(sets) ? `${sets[0]}–${sets[1]}` : undefined,
  reps,
  superset: false,
  optional: opts?.optional,
})

const t = (name: string, note: string, day: number, rows: Row[]): Template => ({
  id: uid(),
  name,
  note,
  day,
  exercises: rows.map(ex),
})

/** Starter program. Sun Upper · Mon Lower · Tue Rest · Wed Pull · Thu Push · Fri Legs · Sat Rest */
export const seedTemplates = (): Template[] => [
  t('Upper', 'Heavy / Strength', 0, [
    ['Iso Incline Chest Press', 3, '5–6'],
    ['Weighted Pull-Ups', 3, '5–6'],
    ['Weighted Dips', 3, '6–8'],
    ['Iso Rows', 3, '6–8'],
    ['Preacher Curls', 3, '6–8'],
    ['Overhead Cable Triceps Extension', 3, '8–10'],
    ['Cable Lateral Raises', [3, 4], '12–15'],
    ['Reverse Pec Deck', 3, '12–15'],
    ['Reverse Curls', [2, 3], '10–12'],
  ]),
  t('Lower', 'Heavy / Strength', 1, [
    ['Leg Curls', 3, '6–8'],
    ['Pendulum Squat', 3, '5–6'],
    ['Romanian Deadlift', 3, '6–8'],
    ['Leg Extensions', 3, '8–10'],
    ['Standing Calf Raises', 4, '10–15'],
    ['Hanging Leg Raises', 3, '10–15'],
  ]),
  t('Pull', 'Hypertrophy', 3, [
    ['Weighted Pull-Ups', 3, '6–8'],
    ['Iso Rows', 3, '8–10'],
    ['Incline Bicep Curls', 3, '8–10'],
    ['Reverse Pec Deck', 3, '12–15'],
    ['Shrugs', 3, '12–15', { optional: true }],
    ['Reverse Curls', [2, 3], '10–12'],
  ]),
  t('Push', 'Hypertrophy', 4, [
    ['Iso Incline Chest Press', 3, '8–10'],
    ['Pec Deck', 3, '10–12'],
    ['Iso Shoulder Press', 3, '8–10'],
    ['Cable Lateral Raises', 4, '12–15'],
    ['Single Overhead Triceps Extension', [2, 3], '10–12'],
    ['Single Triceps Pushdown', 2, '10–12'],
  ]),
  t('Legs', 'Hypertrophy', 5, [
    ['Pendulum Squat', 3, '8–10'],
    ['Romanian Deadlift', 3, '8–10'],
    ['Leg Extensions', 3, '10–12'],
    ['Leg Curls', 3, '10–12'],
    ['Standing Calf Raises', 4, '12–15'],
    ['Hanging Leg Raises', 3, '10–15'],
  ]),
]

/** Exercise renames, applied once to saved workouts and history. */
export const RENAMES: Record<string, string> = {
  'Cable Fly or Pec Deck': 'Pec Deck',
  'Cable or Dumbbell Lateral Raises': 'Cable Lateral Raises',
  'Iso-Lateral Incline Chest Press': 'Iso Incline Chest Press',
}
