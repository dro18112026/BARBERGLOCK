// Runs the Supabase migrations + seed against PGlite with minimal Supabase stubs,
// then exercises the booking rules. Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const db = new PGlite({ extensions: { btree_gist } });

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};
const val = async (sql, params) => (await db.query(sql, params)).rows;
const expectErr = async (sql, params, needle, msg) => {
  try {
    await db.query(sql, params);
    ok(false, `${msg} (no error)`);
  } catch (e) {
    ok(String(e.message).includes(needle), `${msg} → ${e.message}`);
  }
};

// --- Supabase stubs -----------------------------------------------------------
await db.exec(`
  create schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text);
  -- Like Supabase: claims come from the request JWT (set per test below).
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth, public, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  -- No default privileges: migrations must grant everything explicitly.
`);

// --- Migrations + seed --------------------------------------------------------
const migDir = join(root, "supabase", "migrations");
for (const f of readdirSync(migDir).sort()) {
  await db.exec(readFileSync(join(migDir, f), "utf8"));
  console.log(`applied ${f}`);
}
await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8")); // idempotent?
console.log("seed applied twice");

const [{ time_zone: tz }] = await val("select time_zone from booking_settings");
console.log("time zone:", tz);

const CORTE = "00000000-0000-4000-8000-000000000101";
const [{ mon }] = await val(
  `select ((now() at time zone $1)::date + ((8 - extract(isodow from (now() at time zone $1)::date)::int) % 7 + 7 * (case when extract(isodow from (now() at time zone $1)::date) = 1 then 1 else 0 end)))::text as mon`,
  [tz],
);
console.log("next monday:", mon);
const at = (hhmm) => `${mon} ${hhmm}:00-03`;

const slots = async (date = mon, svc = CORTE) =>
  (await val(
    "select to_char(slot_start at time zone $3, 'HH24:MI') as t from get_available_slots($1, $2::date)",
    [svc, date, tz],
  )).map((r) => r.t);

// --- Slots --------------------------------------------------------------------
let s = await slots();
ok(s.length === 15, `Monday has 15 slots: ${s.join(" ")}`);
ok(!s.includes("13:30") && !s.includes("14:00"), "no slot that would overlap lunch");
ok(s.at(-1) === "18:00", "last slot 18:00 (ends 19:00)");

const [{ sun }] = await val(`select ($1::date - 1)::text as sun`, [mon]);
ok((await slots(sun)).length === 0, "Sunday has no slots");
const [{ far }] = await val(`select ((now() at time zone $1)::date + 20)::text as far`, [tz]);
ok((await slots(far)).length === 0, "beyond 14 days → no slots");
const [{ past }] = await val(`select ((now() at time zone $1)::date - 1)::text as past`, [tz]);
ok((await slots(past)).length === 0, "past date → no slots");
const range = await val("select slot_start from get_available_slots_range($1)", [CORTE]);
const [{ n: perMonday }] = await val("select count(*)::int as n from get_available_slots_range($1) where (slot_start at time zone $2)::date = $3::date", [CORTE, tz, mon]);
ok(range.length > 15 && perMonday === 15, `range returns the whole window (${range.length} slots, 15 on Monday)`);

// --- Booking ------------------------------------------------------------------
const book = (t, phone = "+56 9 1111 1111", name = "Juan Pérez", hp = null) =>
  val("select book_appointment($1, $2::timestamptz, $3, $4, $5) as r", [CORTE, at(t), name, phone, hp]);

const [{ r: b1 }] = await book("10:00");
ok(b1.service_name === "Corte" && b1.cancel_token, "book 10:00 OK");
const [{ customer_phone }] = await val("select customer_phone from appointments where id = $1", [b1.id]);
ok(customer_phone === "+56911111111", `phone normalised: ${customer_phone}`);

s = await slots();
ok(!s.includes("10:00") && !s.includes("10:30") && s.includes("11:00"), "10:00 and overlapping 10:30 gone, 11:00 free");

await expectErr("select book_appointment($1, $2::timestamptz, 'Ana', '987654321')", [CORTE, at("10:30")], "SLOT_UNAVAILABLE", "overlapping booking rejected");
await expectErr("select book_appointment($1, $2::timestamptz, 'Ana', '987654321')", [CORTE, at("10:15")], "SLOT_UNAVAILABLE", "off-grid time rejected");
await expectErr("select book_appointment($1, $2::timestamptz, 'Ana', '987654321')", [CORTE, at("13:30")], "SLOT_UNAVAILABLE", "slot overlapping lunch rejected");
await expectErr("select book_appointment($1, $2::timestamptz, 'Ana', '12345')", [CORTE, at("12:00")], "INVALID_PHONE", "bad phone rejected");
await expectErr("select book_appointment($1, $2::timestamptz, ' A ', '987654321')", [CORTE, at("12:00")], "INVALID_NAME", "bad name rejected");
await expectErr("select book_appointment($1, $2::timestamptz, 'Ana', '987654321', 'http://spam')", [CORTE, at("12:00")], "INVALID_REQUEST", "honeypot rejected");

// Constraint holds even bypassing the function.
await expectErr(
  `insert into appointments (barber_id, service_id, customer_name, customer_phone, starts_at, ends_at)
   values ('00000000-0000-4000-8000-000000000001', $1, 'Direct', '+56922222222', $2::timestamptz, $2::timestamptz + interval '45 min')`,
  [CORTE, at("10:45")], "appointments_no_overlap", "exclusion constraint blocks direct overlapping insert");

// Phone limit (2 active).
await book("11:00");
await expectErr("select book_appointment($1, $2::timestamptz, 'Juan', '911111111')", [CORTE, at("12:00")], "PHONE_LIMIT", "3rd active booking for same phone rejected");

// --- Customer view + cancel ---------------------------------------------------
const [{ r: v }] = await val("select get_appointment($1) as r", [b1.cancel_token]);
ok(v.status === "confirmed" && v.can_cancel === true, "get_appointment by token");
const [{ r: c }] = await val("select cancel_appointment($1) as r", [b1.cancel_token]);
ok(c.status === "cancelled", "cancel by token");
ok((await slots()).includes("10:00"), "cancelled slot is free again");
await expectErr("select cancel_appointment($1)", [b1.cancel_token], "NOT_CANCELLABLE", "double cancel rejected");
await expectErr("select cancel_appointment(gen_random_uuid())", [], "NOT_FOUND", "unknown token rejected");
const [{ r: none }] = await val("select get_appointment(gen_random_uuid()) as r");
ok(none === null, "unknown token → null");
await book("12:00", "+56 9 1111 1111"); // limit freed after cancel
ok(true, "phone can book again after cancelling");

// --- Time off -----------------------------------------------------------------
await db.query(
  `insert into time_off (barber_id, starts_at, ends_at, reason)
   values ('00000000-0000-4000-8000-000000000001', $1::timestamptz, $2::timestamptz, 'Trámite')`,
  [at("15:00"), at("16:00")],
);
s = await slots();
ok(!s.includes("14:30") && !s.includes("15:00") && !s.includes("15:30") && s.includes("16:00"), `time off 15–16 removes 14:30/15:00/15:30: ${s.join(" ")}`);

// --- RLS as anon --------------------------------------------------------------
await db.exec("set role anon");
await expectErr("select count(*) from appointments", [], "permission denied", "anon cannot read appointments");
await expectErr("select count(*) from time_off", [], "permission denied", "anon cannot read time off");
ok((await val("select count(*)::int as n from services"))[0].n === 3, "anon reads services");
await expectErr(
  `insert into appointments (barber_id, service_id, customer_name, customer_phone, starts_at, ends_at)
   values ('00000000-0000-4000-8000-000000000001', $1, 'Hacker', '+56933333333', $2::timestamptz, $2::timestamptz + interval '1 hour')`,
  [CORTE, at("17:00")], "permission denied", "anon cannot insert directly");
await expectErr("update services set price_clp = 1", [], "permission denied", "anon cannot update services");
ok((await val("select price_clp from services where id = $1", [CORTE]))[0].price_clp === 10000, "anon cannot change prices");
await expectErr("select default_barber_id()", [], "permission denied", "anon cannot call internal function");
await expectErr(
  "select book_appointment($1, $2::timestamptz, 'María', '+56 9 4444 4444')",
  [CORTE, at("17:00")], "permission denied", "anon cannot book directly (server-only)");
await expectErr("select hit_rate_limit('x', 1, 60)", [], "permission denied", "anon cannot touch the rate limiter");
await expectErr("select count(*) from rate_limits", [], "permission denied", "anon cannot read rate limits");
await db.exec("reset role");

// --- Server (service_role): booking + rate limit --------------------------------
await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
await db.exec("set role service_role");
const [{ r: b3 }] = await val("select book_appointment($1, $2::timestamptz, 'María', '+56 9 4444 4444') as r", [CORTE, at("17:00")]);
ok(b3.status === "confirmed", "service_role books via RPC");
const hits = [];
for (let i = 0; i < 4; i++) hits.push((await val("select hit_rate_limit('ip-a', 3, 3600) as ok"))[0].ok);
ok(hits.join() === "true,true,true,false", `rate limit allows 3 then blocks: ${hits.join()}`);
ok((await val("select hit_rate_limit('ip-b', 3, 3600) as ok"))[0].ok === true, "rate limit is per key");
await expectErr("select hit_rate_limit('ip-c', 1, 90000)", [], "window too long", "rate limit window capped at 1 day");
await db.exec("reset role");

// --- Roles: barber / superadmin / plain user ----------------------------------
const SUPER = "11111111-1111-4111-8111-111111111111";
const BARBER = "33333333-3333-4333-8333-333333333333";
const NOBODY = "22222222-2222-4222-8222-222222222222";
await db.exec(`
  insert into auth.users (id, email) values
    ('${SUPER}', 'yo@prueba.test'), ('${BARBER}', 'barbero@prueba.test'), ('${NOBODY}', 'otro@prueba.test');
  insert into staff (user_id, role) values ('${SUPER}', 'superadmin'), ('${BARBER}', 'barber');
`);
/** Act as an authenticated user with the given JWT claims. */
const as = async (sub, aal = "aal1") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub, role: "authenticated", aal }),
  ]);
  await db.exec("set role authenticated");
};
const n = async (sql, params) => (await val(sql, params))[0].n;

await as(NOBODY);
ok((await n("select count(*)::int as n from appointments")) === 0, "plain signed-in user sees no appointments");
ok((await val("select my_role() as r"))[0].r === null, "plain user has no role");

await as(BARBER);
ok((await val("select my_role() as r"))[0].r === "barber", "barber role");
ok((await n("select count(*)::int as n from appointments")) > 0, "barber sees appointments");
await db.exec("update booking_settings set max_days_ahead = 30");
await db.exec("reset role");
ok((await n("select max_days_ahead as n from booking_settings")) === 14, "barber cannot change booking rules");
await as(BARBER);
ok((await n("select count(*)::int as n from audit_log")) === 0, "barber cannot read audit log");
await expectErr("select * from staff_list()", [], "FORBIDDEN", "barber cannot list staff");
await db.exec("update services set price_clp = 11000 where name = 'Corte'");
await db.exec("reset role");
ok((await n("select price_clp as n from services where name = 'Corte'")) === 11000, "barber can change prices");

await as(SUPER);
ok((await val("select is_superadmin() as r"))[0].r === true, "superadmin role");
await db.exec("update booking_settings set max_days_ahead = 21");
await db.exec("reset role");
ok((await n("select max_days_ahead as n from booking_settings")) === 21, "superadmin changes booking rules");
await as(SUPER);
const list = await val("select email, role::text from staff_list()");
ok(list.length === 2, `superadmin lists staff: ${list.map((x) => x.email + "=" + x.role).join(", ")}`);
await db.exec("select staff_grant('OTRO@prueba.test', 'barber')");
ok((await n("select count(*)::int as n from staff")) === 3, "superadmin grants access by email (case-insensitive)");
await expectErr("select staff_grant('noexiste@prueba.test', 'barber')", [], "USER_NOT_FOUND", "grant to unknown email fails");
await db.query("select staff_revoke($1)", [NOBODY]);
ok((await n("select count(*)::int as n from staff")) === 2, "superadmin revokes access");
await expectErr("select staff_revoke($1)", [SUPER], "CANNOT_REVOKE_SELF", "superadmin cannot revoke self");
await expectErr(`update staff set role = 'barber' where user_id = '${SUPER}'`, [], "LAST_SUPERADMIN", "cannot remove the last superadmin");

// --- Audit log ------------------------------------------------------------------
const audit = await val(
  "select actor_role, action, table_name, new_data from audit_log order by id",
);
const priceChange = audit.find((a) => a.table_name === "services" && a.action === "UPDATE");
ok(priceChange?.actor_role === "barber" && Object.keys(priceChange.new_data).join() === "price_clp",
  `price change logged as barber with only the changed column: ${JSON.stringify(priceChange?.new_data)}`);
ok(audit.some((a) => a.table_name === "booking_settings" && a.actor_role === "superadmin"), "rule change logged as superadmin");
ok(audit.some((a) => a.table_name === "staff" && a.action === "DELETE"), "staff changes logged");
ok(audit.some((a) => a.table_name === "appointments" && a.action === "INSERT"), "bookings logged");
ok(audit.some((a) => a.table_name === "appointments" && a.action === "INSERT" && a.actor_role === "web"), "website bookings logged as 'web'");

// --- Price snapshot + source ----------------------------------------------------
{
  await db.exec("reset role");
  const rows = await val("select customer_name, price_clp, source from appointments where customer_name in ('María', 'Juan Pérez') order by created_at");
  ok(rows.every((r) => r.price_clp > 0), `bookings store the price: ${rows.map((r) => r.price_clp).join(", ")}`);
  ok(rows.find((r) => r.customer_name === "María")?.source === "web", "website booking marked source = web");
  await as(BARBER);
  await db.query(
    `insert into appointments (barber_id, service_id, customer_name, customer_phone, starts_at, ends_at)
     values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'Panel Cliente', '+56988888888',
             now() + interval '20 days', now() + interval '20 days 1 hour')`,
  );
  await db.exec("reset role");
  const p = (await val("select price_clp, source from appointments where customer_name = 'Panel Cliente'"))[0];
  ok(p.source === "panel" && p.price_clp === 7000, `panel booking: source=${p.source}, price=${p.price_clp}`);
  await db.exec("update services set price_clp = 9999 where name = 'Barba'");
  ok((await n("select price_clp as n from appointments where customer_name = 'Panel Cliente'")) === 7000,
    "later price change does not rewrite booked price");
  await db.exec("update appointments set service_id = '00000000-0000-4000-8000-000000000102' where customer_name = 'Panel Cliente'");
  ok((await n("select price_clp as n from appointments where customer_name = 'Panel Cliente'")) === 15000,
    "changing the service takes the new service price");
  await db.exec("update services set price_clp = 7000 where name = 'Barba'");
}

// --- Data retention -------------------------------------------------------------
await db.exec("reset role");
await db.query(
  `insert into appointments (barber_id, service_id, customer_name, customer_phone, starts_at, ends_at, status, notes)
   values ('00000000-0000-4000-8000-000000000001', $1, 'Cliente Antiguo', '+56977777777',
           now() - interval '2 years', now() - interval '2 years' + interval '1 hour', 'completed', 'nota')`,
  [CORTE],
);
await as(BARBER);
await expectErr("select purge_personal_data(12)", [], "FORBIDDEN", "barber cannot purge");
await as(SUPER);
const [{ r: purged }] = await val("select purge_personal_data(12) as r");
await db.exec("reset role");
const old = (await val("select customer_name, customer_phone, notes from appointments where starts_at < now() - interval '1 year'"))[0];
ok(purged.appointments === 1 && old.customer_name === "Anónimo" && old.customer_phone === "+56900000000" && old.notes === null,
  `purge anonymises old appointments: ${JSON.stringify(purged)}`);
ok((await n("select count(*)::int as n from audit_log where action = 'UPDATE' and old_data::text like '%Cliente Antiguo%'")) === 0,
  "anonymisation itself is not written to the audit log");
ok((await n("select count(*)::int as n from audit_log where action = 'PURGE'")) === 1, "purge run is logged");
ok((await n("select count(*)::int as n from appointments where customer_name <> 'Anónimo'")) > 0, "recent appointments untouched");
await db.exec("set role anon");
await expectErr("select purge_personal_data(12)", [], "permission denied", "anon cannot purge");
await db.exec("reset role");

// --- Two-step verification (TOTP) ------------------------------------------------
await db.exec(`insert into auth.mfa_factors (user_id, status) values ('${SUPER}', 'verified')`);
await as(SUPER, "aal1");
ok((await val("select is_admin() as a, is_superadmin() as s, mfa_pending() as p"))[0].a === false,
  "with 2FA enrolled, an aal1 session is not staff");
ok((await val("select mfa_pending() as p"))[0].p === true, "mfa_pending tells the UI to ask for the code");
ok((await n("select count(*)::int as n from appointments")) === 0, "aal1 session sees no appointments");
await as(SUPER, "aal2");
ok((await val("select is_superadmin() as s"))[0].s === true, "after the code (aal2) superadmin works again");
await as(BARBER, "aal1");
ok((await val("select is_admin() as a"))[0].a === true, "staff without 2FA unaffected");
await db.exec("reset role");

// --- Push notifications ----------------------------------------------------------
{
  const EP = "https://push.example.test/device-1";
  const sub = (endpoint = EP) => `select push_subscribe('${endpoint}', 'key-p256dh', 'key-auth', 'Test UA')`;

  await db.exec("select set_config('request.jwt.claims', '{}', false)");
  await db.exec("set role anon");
  await expectErr(sub(), [], "permission denied", "anon cannot register a push device");
  await db.exec("reset role");

  await as(NOBODY);
  await expectErr(sub(), [], "FORBIDDEN", "non-staff cannot register a push device");
  await as(BARBER);
  await expectErr(sub("http://insecure.test/x"), [], "INVALID_SUBSCRIPTION", "push endpoint must be https");
  await db.exec(sub());
  await db.exec(sub()); // same device again: no duplicate
  ok((await n("select count(*)::int as n from push_subscriptions")) === 1, "barber registers a device (idempotent)");
  await expectErr("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://x.test', 'a', 'b')",
    [], "permission denied", "push devices are written only via push_subscribe");

  await as(SUPER, "aal2");
  ok((await n("select count(*)::int as n from push_subscriptions")) === 0, "staff only see their own devices");
  await db.exec(sub());
  await db.exec("reset role");
  ok((await val(`select user_id from push_subscriptions where endpoint = '${EP}'`))[0].user_id === SUPER,
    "same device used with another account moves to that account");
  await as(BARBER);
  await db.exec(`select push_unsubscribe('${EP}')`);
  await db.exec("reset role");
  ok((await n("select count(*)::int as n from push_subscriptions")) === 1, "cannot unsubscribe someone else's device");
  await as(SUPER, "aal2");
  await db.exec(`select push_unsubscribe('${EP}')`);
  await db.exec("reset role");
  ok((await n("select count(*)::int as n from push_subscriptions")) === 0, "owner unsubscribes the device");

  // Reminders
  const appt = async (name, startsIn, status = "confirmed") =>
    (await val(
      `insert into appointments (barber_id, service_id, customer_name, customer_phone, starts_at, ends_at, status)
       values ('00000000-0000-4000-8000-000000000001', $1, $2, '+56966666666',
               now() + $3::interval, now() + $3::interval + interval '40 minutes', $4)
       returning id`,
      [CORTE, name, startsIn, status],
    ))[0].id;
  const soon = await appt("Pronto", "20 minutes");
  await appt("Cancelado Pronto", "25 minutes", "cancelled");
  await appt("Más Tarde", "3 hours");

  await as(BARBER);
  await expectErr("select * from claim_push_reminders(30)", [], "permission denied", "staff cannot claim reminders (server only)");
  await db.exec("reset role");
  await db.exec("set role service_role");
  const first = await val("select customer_name, service_name from claim_push_reminders(30)");
  ok(first.length === 1 && first[0].customer_name === "Pronto" && first[0].service_name === "Corte",
    `reminder due only for the live appointment within 30 min: ${JSON.stringify(first)}`);
  ok((await val("select * from claim_push_reminders(30)")).length === 0, "a reminder is sent only once");
  await db.exec("reset role");
  await db.query("update appointments set starts_at = starts_at + interval '5 minutes', ends_at = ends_at + interval '5 minutes' where id = $1", [soon]);
  await db.exec("set role service_role");
  ok((await val("select * from claim_push_reminders(30)")).length === 1, "rescheduled appointment gets a new reminder");
  await db.exec("reset role");
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
