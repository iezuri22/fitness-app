# Admin scripts

Node scripts that talk directly to Firestore with the Admin SDK. Used by
scheduled tasks (e.g. `weekly-workout-planner`) to push data into Lift
without requiring the user to sign in.

## Setup (one-time)

1. Download a service account key from Firebase Console → Project settings →
   Service accounts → Generate new private key.
2. Save it to `~/.config/lift/admin-key.json` with `chmod 600`.
3. `cd fitness-app/scripts && npm install`

The service account key is root-level auth to the project — **never commit
it**, and never share it. `.gitignore` in the repo root already excludes
`admin-key.json`.

## Push a week of workouts

```bash
# From stdin
cat plan.json | npm run push

# From a file
npm run push < plan.json

# Preview without writing
npm run dry-run < plan.json
```

### Plan JSON shape

```json
{
  "userEmail": "iezuri22@gmail.com",
  "workouts": [
    {
      "date": "2026-04-21",
      "title": "4/21 — Upper Body + Shoulder Rehab",
      "focus": "Upper Body",
      "notes": "",
      "sets": [
        {
          "exerciseName": "Sitting Shoulder Pulleys",
          "order": 1,
          "targetReps": 15,
          "targetWeight": null,
          "setType": "PT/Rehab",
          "restSeconds": 30
        }
      ]
    }
  ]
}
```

### Behavior

- Looks up user by email → UID via Admin Auth.
- Resolves each `exerciseName` to its Firestore `exerciseId` via normalized
  name match against `/users/{uid}/exercises`.
- Missing exercise names fail the whole run (exit code 3) — forces you to
  fix typos rather than create broken workouts.
- Upserts by `date`: if a workout already exists for that date, it's
  overwritten. Safe to re-run.

## Exit codes

- `0` — success
- `1` — unexpected error (check stack trace)
- `2` — config error (key missing, input malformed)
- `3` — one or more exercises in the plan don't exist in the library
