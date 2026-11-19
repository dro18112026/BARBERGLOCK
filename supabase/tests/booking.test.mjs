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
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public, extensions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
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
const [{ r: b3 }] = await val("select book_appointment($1, $2::timestamptz, 'María', '+56 9 4444 4444') as r", [CORTE, at("17:00")]);
ok(b3.status === "confirmed", "anon books via RPC");
await db.exec("reset role");

// --- Admin via RLS ------------------------------------------------------------
await db.exec(`
  insert into auth.users values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
  insert into admins values ('11111111-1111-4111-8111-111111111111');
`);
await db.exec("set role authenticated");
await db.exec("select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false)");
ok((await val("select count(*)::int as n from appointments"))[0].n === 0, "non-admin authenticated user sees no appointments");
await db.exec("select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false)");
ok((await val("select count(*)::int as n from appointments"))[0].n > 0, "admin sees appointments");
await db.exec("reset role");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
