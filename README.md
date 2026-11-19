# BARBERGLOCK — Agenda online (PWA)

Online booking app + admin panel for a single-barber shop in Chile Chico, Aysén.
Customers book from a link (no account); the barber manages the schedule from an installable PWA.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) · Netlify

Full product brief (in Spanish): [`docs/barberia-agenda-proyecto.md`](docs/barberia-agenda-proyecto.md)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase keys
npm run dev                  # http://localhost:3000
```

Node 24 (see `.nvmrc`).

## Project structure

```
src/
  app/              routes (App Router)
  config/site.ts    per-barbershop settings: name, time zone, booking rules
  lib/env.ts        env var access + validation
  lib/supabase/     clients: browser (client.ts), server (server.ts), service role (admin.ts)
public/brand/       logo
supabase/           SQL migrations + seed (Phase 2)
docs/               product brief
```

## Database (Supabase)

Schema, RLS and booking functions live in `supabase/migrations/`; initial data in `supabase/seed.sql`.

```bash
npm run test:db                                   # run the SQL test suite locally (PGlite, no Docker)
npx supabase login                                # once, opens the browser
npm run db:link -- --project-ref <project-ref>    # asks for the DB password
npm run db:push -- --include-seed                 # first time; later just `npm run db:push`
```

Public API (Postgres functions, callable with the anon key):

| Function | Purpose |
|----------|---------|
| `get_available_slots(service_id, date)` | free start times for a local date |
| `book_appointment(service_id, starts_at, name, phone, honeypot?)` | creates a booking, returns its `cancel_token` |
| `get_appointment(token)` / `cancel_appointment(token)` | customer's own booking |

Errors come back as codes (`SLOT_UNAVAILABLE`, `PHONE_LIMIT`, `INVALID_PHONE`, `INVALID_NAME`, `TOO_LATE`, …).

Double booking is prevented by the `appointments_no_overlap` exclusion constraint, so it holds even under concurrent requests.

**Admin access:** create the user in Supabase → Authentication → Users, then run
`insert into public.admins (user_id) values ('<user uuid>');` in the SQL editor.
Turn off public sign-ups (Authentication → Sign In / Providers → "Allow new users to sign up").

## Design tokens

Tailwind theme in `src/app/globals.css`:

| Token | Hex | Use |
|-------|-----|-----|
| `ink` | `#141414` | text, header |
| `bone` | `#F4F0E6` | page background |
| `paper` | `#FFFFFF` | cards |
| `barber` | `#B4232A` | primary actions only |
| `steel` | `#1E3A52` | links, admin accents |
| `smoke` | `#6E6E6E` | secondary text, borders |

Fonts: `font-display` (Bebas Neue) for headings, `font-sans` (Atkinson Hyperlegible) for body.

## Portability

The app is plain Next.js with no host-specific APIs. `netlify.toml` is the only host file.

**Cambiar de hosting:**
- **Vercel:** import the repo; zero config. Delete `netlify.toml`.
- **Cloudflare Workers:** add `@opennextjs/cloudflare` and follow its Next.js guide.
- **VPS / Docker:** set `output: "standalone"` in `next.config.ts`, then `npm run build && node .next/standalone/server.js`.

In every case, copy the env vars from `.env.example`.

**Replicar para otra barbería:** new Supabase project → apply `supabase/migrations` → edit `src/config/site.ts` and `public/brand/logo.*` → new env vars → deploy.
