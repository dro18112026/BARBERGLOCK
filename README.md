# BARBERGLOCK — Agenda online (PWA)

Online booking app + admin panel for a single-barber shop in Chile Chico, Aysén.
Customers book from a link (no account); the barber manages the schedule from an installable PWA.

**Live:** https://barberglock.netlify.app

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

**Password recovery** ("¿Olvidaste tu contraseña?" on the login page) needs two settings in the Supabase dashboard:

1. Authentication → URL Configuration: **Site URL** = the live URL (e.g. `https://barberglock.netlify.app`), and add `https://<your-site>/admin/recuperar/link` to **Redirect URLs**.
2. Authentication → Emails → **Reset Password**: paste the body of [`supabase/templates/recovery.html`](supabase/templates/recovery.html) (subject: "Crea tu contraseña nueva"). Its link carries a token hash, so it works even if the email is opened on another device.

Supabase's built-in email sender only allows a few emails per hour; set up custom SMTP (Authentication → Emails → SMTP) if that's not enough.

## Push notifications (panel)

The barber gets a notification on their phone when a customer books or cancels on the website, and 30 minutes before every appointment. Each device turns them on in **Panel → Mi cuenta → Avisos en el celular** (iPhone: only from the Panel app installed on the home screen, iOS 16.4+).

Setup, once per barbershop:

1. Generate keys: `npx web-push generate-vapid-keys`, plus a long random string for `PUSH_CRON_SECRET`.
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (site URL) and `PUSH_CRON_SECRET` on the host and redeploy.
3. Apply the migrations (`npm run db:push`). It enables `pg_net` and schedules `push-reminders` (every 5 min) with `pg_cron`.
4. In the Supabase SQL editor, store the site URL and the same secret in Vault:

   ```sql
   select vault.create_secret('https://<your-site>', 'push_site_url');
   select vault.create_secret('<PUSH_CRON_SECRET>', 'push_cron_secret');
   ```

Changing the VAPID keys invalidates every device: each one has to turn notifications on again. Check the cron runs with `select * from cron.job_run_details order by start_time desc limit 5;` and the HTTP replies with `select status_code, content from net._http_response order by created desc limit 5;`.

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

**Icons:** replace `public/brand/logo.jpg` and run `npm run icons` to regenerate the PWA icons, favicon and web logo.
