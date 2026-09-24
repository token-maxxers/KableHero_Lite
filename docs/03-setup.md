# Setup

## Stack

- React + TypeScript on TanStack Start (Vite), Tailwind CSS v4
- Leaflet + OpenStreetMap tiles for the maps
- Lovable Cloud (Postgres + Auth + Realtime + Storage) for data and files
- Installable PWA (web app manifest + icons)

## Environment variables

Provisioned automatically by Lovable Cloud and written to `.env`:

| Variable | Used by |
| --- | --- |
| `VITE_SUPABASE_URL` | browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client |
| `VITE_SUPABASE_PROJECT_ID` | tooling |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server-side rendering |

No extra keys are needed: OpenStreetMap tiles require no token, and there is no
AI/ML in the app.

## Backend setup

Everything is applied by the migration in `drizzle/migrations/`:
enums, `profiles`, `user_roles`, `reports`, `validations`, the XP and
verification triggers, the `has_role()` helper, RLS policies, and realtime on
`reports`. The private `hazard-photos` storage bucket (10 MB per file) is created
alongside it.

Sign-in methods enabled: email + password, and Google.

### Granting the dispatcher role

Roles are assigned in the database (there is no admin UI yet):

```sql
insert into public.user_roles (user_id, role)
values ('<auth user id>', 'dispatcher')
on conflict do nothing;
```

Use `'tanod'` for barangay verification staff. Every new sign-up automatically
receives `citizen`.

## Running locally

```bash
bun install
bun run dev      # http://localhost:8080
bun run build    # production build
```

Copy the `.env` values from the Cloud project before running locally.

## Installing as a PWA

The app ships `public/manifest.webmanifest`, maskable icons and theme colour, so
Android Chrome offers "Install app" and iOS Safari supports "Add to Home Screen".
It then launches standalone, full-screen, with the app icon.

Offline caching (service worker) is **not** enabled in this scaffold — see the
SMS Gateway Fallback section of the roadmap, where offline behaviour is designed
together with the offline submission path.

## Field notes

- Camera capture uses the device camera directly; photos are capped at 10 MB by
  the bucket. Compressing on-device before upload is a good next optimisation for
  2G/3G areas.
- Location requires HTTPS and user permission. If permission is denied, the
  submit button stays locked, because a report without coordinates is not
  dispatchable.
