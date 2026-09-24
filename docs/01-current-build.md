# KableHero Lite (LinemanQuest) — Current build overview

Mobile-first PWA for crowdsourced electric hazard reporting and dispatch triage,
built for Philippine electric cooperatives, barangays and residents.

## What is implemented

### 1. Reporter flow (`/`)
- One screen capture: `navigator.geolocation` for lat/lng (accuracy shown) and
  `<input type="file" accept="image/*" capture="environment">` for photo proof.
- 3-button hazard selector, no text form:
  - 🔴 **Critical** — downed live wire, wire in water or across a path
  - 🟠 **Urgent** — leaning pole, damaged or arcing transformer
  - 🟡 **Low** — dangling telecom cable, encroaching branches
- **Safe-Distance Hold gate**: a press-and-hold button that must be held for a
  continuous 3 seconds (`pointerdown` starts a 50 ms interval timer,
  `pointerup`/`pointerleave`/`pointercancel` reset it unless it completed). The
  Submit button stays disabled until the hold completes. Changing the hazard
  tier resets the gate.
- On submit: the photo is uploaded to the private `hazard-photos` bucket under
  `<user id>/<uuid>.<ext>`, a `reports` row is inserted, and a database trigger
  awards **+50 XP** to the reporter.

### 2. Community validation (`/map`)
- Tapping a pin opens a card with the photo (rendered through a 1-hour signed
  URL, since the bucket is private), coordinates, status and verification count.
- **Still Broken** / **Resolved** buttons insert a `validations` row. A unique
  constraint on `(report_id, user_id)` prevents double voting.
- A trigger awards **+20 XP** per vote and increments `reports.verification_count`
  on a "Still Broken" vote, giving dispatchers a confidence signal and reducing
  duplicate dispatch.

### 3. Gamification
- `profiles.xp_total` is the single source of truth, only ever changed by
  database triggers — the client never writes XP.
- Civic tiers: **Purok Scout** (0 XP) → **Tanod Specialist** (250 XP) →
  **Master Lineman** (1000 XP).
- `/profile` shows tier, XP, progress to the next tier, badge ladder, reports
  filed and validations cast.

### 4. Dispatcher map (`/map`)
- Leaflet + OpenStreetMap tiles, dark-tuned via CSS filters.
- Pins are colour-coded by hazard tier; resolved pins are faded; the selected
  pin is enlarged. Tier filter chips above the map.
- Status flow **Reported → Dispatched → Resolved**; the status buttons only
  render for users holding the `dispatcher` or `tanod` role, and RLS enforces
  the same rule server-side.
- Realtime: a Supabase `postgres_changes` subscription on `reports` invalidates
  the query cache, so the map updates with no manual refresh.

## Data model

| Table | Columns |
| --- | --- |
| `profiles` | `id` (auth user id), `display_name`, `xp_total`, `created_at` |
| `user_roles` | `id`, `user_id`, `role` (`citizen` / `dispatcher` / `tanod`), unique per pair |
| `reports` | `id`, `user_id`, `lat`, `lng`, `photo_url`, `hazard_tier`, `status`, `verification_count`, `note`, `created_at`, `updated_at` |
| `validations` | `id`, `report_id`, `user_id`, `vote` (`still_broken` / `resolved`), `created_at`, unique `(report_id, user_id)` |

Enums: `app_role`, `hazard_tier`, `report_status`, `vote_type`.

Triggers / functions:
- `handle_new_user()` on `auth.users` insert → creates the profile and grants the
  default `citizen` role.
- `award_report_xp()` → +50 XP per report.
- `handle_validation()` → +20 XP per vote, increments `verification_count`.
- `has_role(user_id, role)` — `SECURITY DEFINER`, used by RLS policies to avoid
  recursive policy evaluation.

## Security posture

- RLS is on for every table. Reports, profiles and validations are publicly
  readable (the hazard map is a public-safety surface); inserts are restricted to
  the authenticated owner; report status updates require `dispatcher` or `tanod`.
- Roles live in a separate `user_roles` table — never on `profiles` — so a user
  cannot escalate privileges by editing their own profile row.
- Photos are in a **private** bucket; the app reads them through short-lived
  signed URLs.
- Roles are currently assigned directly in the database (see setup docs); there
  is no in-app role management screen yet.

## Performance notes

- Leaflet is lazy-loaded and only mounts after hydration, so the reporter flow
  loads without map code.
- No on-device AI/ML/OCR. Dependencies are limited to the app framework,
  Leaflet and the backend client.
- The reporter flow is three taps (photo, tier, hold) before submit.
