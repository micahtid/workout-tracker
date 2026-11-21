import type { Template, TemplateExercise } from './workouts'

type Row = [name: string, sets: number | [min: number, max: number], reps: string, rest: number, opts?: { ss?: boolean; optional?: boolean }]

const ex = ([name, sets, reps, rest, opts]: Row): TemplateExercise => ({
  id: crypto.randomUUID(),
  name,
  sets: Array.isArray(sets) ? sets[1] : sets,
  setsNote: Array.isArray(sets) ? `${sets[0]}–${sets[1]}` : undefined,
  reps,
  rest,
  superset: !!opts?.ss,
  optional: opts?.optional,
})

const t = (name: string, note: string, day: number, rows: Row[]): Template => ({
  id: crypto.randomUUID(),
  name,
  note,
  day,
  exercises: rows.map(ex),
})

// Superset rest: the first exercise's rest is the gap between exercises (30s);
// the second's is the rest after each round.
const SS = { ss: true }

/** Starter program. Sun Upper · Mon Lower · Tue Pull · Wed Rest · Thu Push · Fri Legs · Sat Rest */
export const seedTemplates = (): Template[] => [
  t('Upper', 'Heavy / Strength', 0, [
    ['Iso Incline Chest Press', 3, '5–6', 180],
    ['Weighted Pull-Ups', 3, '5–6', 180],
    ['Weighted Dips', 3, '6–8', 150],
    ['Iso Rows', 3, '6–8', 150],
    ['Preacher Curls', 3, '6–8', 30, SS],
    ['Overhead Cable Triceps Extension', 3, '8–10', 90],
    ['Cable Lateral Raises', [3, 4], '12–15', 30, SS],
    ['Reverse Pec Deck', 3, '12–15', 60],
    ['Reverse Curls', [2, 3], '10–12', 60],
  ]),
  t('Lower', 'Heavy / Strength', 1, [
    ['Leg Curls', 3, '6–8', 120],
    ['Pendulum Squat', 3, '5–6', 180],
    ['Romanian Deadlift', 3, '6–8', 180],
    ['Leg Extensions', 3, '8–10', 90],
    ['Standing Calf Raises', 4, '10–15', 30, SS],
    ['Hanging Leg Raises', 3, '10–15', 90],
  ]),
  t('Pull', 'Hypertrophy', 2, [
    ['Weighted Pull-Ups', 3, '6–8', 150],
    ['Iso Rows', 3, '8–10', 120],
    ['Incline Bicep Curls', 3, '8–10', 90],
    ['Reverse Pec Deck', 3, '12–15', 30, SS],
    ['Shrugs', 3, '12–15', 90, { optional: true }],
    ['Reverse Curls', [2, 3], '10–12', 60],
  ]),
  t('Push', 'Hypertrophy', 4, [
    ['Iso Incline Chest Press', 3, '8–10', 150],
    ['Pec Deck', 3, '10–12', 90],
    ['Iso Shoulder Press', 3, '8–10', 120],
    ['Cable Lateral Raises', 4, '12–15', 60],
    ['Single Overhead Triceps Extension', [2, 3], '10–12', 60],
    ['Single Triceps Pushdown', 2, '10–12', 60],
  ]),
  t('Legs', 'Hypertrophy', 5, [
    ['Pendulum Squat', 3, '8–10', 180],
    ['Romanian Deadlift', 3, '8–10', 180],
    ['Leg Extensions', 3, '10–12', 90],
    ['Leg Curls', 3, '10–12', 90],
    ['Standing Calf Raises', 4, '12–15', 30, SS],
    ['Hanging Leg Raises', 3, '10–15', 90],
  ]),
]

/** Exercise renames, applied once to saved workouts and history. */
export const RENAMES: Record<string, string> = {
  'Cable Fly or Pec Deck': 'Pec Deck',
  'Cable or Dumbbell Lateral Raises': 'Cable Lateral Raises',
  'Iso-Lateral Incline Chest Press': 'Iso Incline Chest Press',
}
