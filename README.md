# Workout Tracker

A minimal workout tracker built for your phone.

Live at https://wt.micahtid.com.

## Features

- Reusable workouts for each day of the week.
- Last session's weight and reps shown for every set.
- Progress charts for every exercise.
- Works offline and syncs across devices.

## Stack

- Vue 3, Vite and Pinia.
- Convex.
- Cloudflare.

## Develop

```sh
npm install
npm run dev
```

## Deploy

Add `CONVEX_DEPLOY_KEY` to `.env.local`, then run:

```sh
npx convex deploy
npm run deploy
```
