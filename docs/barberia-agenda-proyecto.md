# Proyecto: BARBERGLOCK — App de Agenda (PWA)

> Brief de proyecto para desarrollar con Claude Code.
> **Barbería:** BARBERGLOCK · Chile Chico, Región de Aysén, Chile.
> Barbería pequeña de localidad, **un solo barbero**. Objetivo: reservas online simples + panel de administración, con hosting gratuito y acceso desde cualquier dispositivo.
> **Visión:** replicar el sistema en barberías de otras localidades → el proyecto debe ser **portable** (cambiar de hosting sin reescribir) y **configurable por barbería** (marca, zona horaria, reglas).

---

## 1. Contexto y objetivo

Aplicación web **instalable como PWA** para que los clientes de BARBERGLOCK reserven hora online y el barbero/administrador gestione la agenda desde cualquier parte (celular o computador, iPhone o Android).

**Decisiones ya tomadas:**
- Es una **web (PWA)**, no una app nativa. Un solo desarrollo sirve para iOS y Android. Nada de App Store ni Play Store.
- Los **clientes reservan desde un link** en el navegador, sin instalar nada ni crearse cuenta (pensado para gente mayor y poco tecnológica).
- El **administrador** (el barbero) puede "instalar" la PWA en su celular para acceso rápido.
- **Un solo barbero**: el cliente NO elige barbero, solo servicio, fecha y hora.
- **Carga baja**: decenas/cientos de citas al mes. La escalabilidad se resuelve con buen diseño de datos, no con infraestructura cara.
- **Hosting gratuito** en capas free que permitan uso comercial (ver sección 3). Costo inicial ≈ $0 (opcional: dominio propio ~$10.000 CLP/año).
- **Código en inglés, interfaz en español** (Chile).

---

## 2. Marca y paleta de colores

**Nombre:** BARBERGLOCK
**Logo:** ilustración estilo grabado/tatuaje en blanco y negro (barbero con barba, postes de barbería, marco ornamental). Usar el logo tal cual, sin recolorear. Archivo: `public/brand/logo.jpg`.
**Estilo visual:** barbería tradicional con actitud. Vintage, masculino, alto contraste.

**Paleta "Vintage Barber":**

| Color | Hex | Token Tailwind | Uso |
|-------|-----|----------------|-----|
| Negro tinta | `#141414` | `ink` | Base, textos, títulos, barra superior |
| Blanco hueso | `#F4F0E6` | `bone` | Fondo general (papel vintage cálido) |
| Blanco puro | `#FFFFFF` | `paper` | Tarjetas/paneles sobre el fondo crema |
| **Rojo barbero** | `#B4232A` | `barber` | **Acento principal**: botones de acción, hora seleccionada, alertas |
| Azul acero | `#1E3A52` | `steel` | Secundario sutil: links, acentos del panel admin |
| Gris humo | `#6E6E6E` | `smoke` | Textos secundarios, bordes, estados deshabilitados |

**Regla de uso:** principalmente **negro sobre crema**. El **rojo** solo en lo accionable. El azul es de apoyo.

**Tipografías:** `Bebas Neue` (display, títulos) + `Atkinson Hyperlegible` (cuerpo; diseñada para máxima legibilidad, ideal para usuarios mayores).

---

## 3. Stack técnico

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Frontend | **Next.js 16 (App Router) + TypeScript** | Estándar, portable a cualquier host con Node |
| Estilos | **Tailwind CSS v4** | Rápido, responsive, mobile-first |
| Backend + DB | **Supabase** (PostgreSQL + Auth) | Capa gratis generosa, auth incluido |
| PWA | `app/manifest.ts` nativo de Next + service worker (Serwist o manual) | `next-pwa` está abandonado |
| Hosting frontend | **Netlify** (free, permite uso comercial) | Soporte Next.js sin configuración, HTTPS incluido |
| Hosting DB/Auth | **Supabase** (free) | — |
| Notificaciones | **Link de WhatsApp (`wa.me`)** en la confirmación; email (Resend) opcional | Gratis y natural para el público |

### Portabilidad (para migrar a hosting pagado o replicar)
- **Sin APIs propietarias del host**: nada de `@netlify/*`, `@vercel/*` ni bindings de Cloudflare en el código. Solo Next.js estándar.
- `netlify.toml` es el **único** archivo específico del host. Para migrar: Vercel (cero config), Cloudflare (`@opennextjs/cloudflare`) o un VPS/Docker con `next start` (`output: "standalone"`).
- `cacheComponents` / PPR **desactivados**: requieren infraestructura de caché que no todos los hosts soportan igual. La app es pequeña y dinámica; no los necesita.
- **Toda la configuración por barbería** vive en variables de entorno + `src/config/site.ts` (nombre, zona horaria, reglas de reserva). Replicar = nuevo proyecto Supabase + nuevas env vars + logo.
- **Esquema de BD versionado** como migraciones SQL en `supabase/migrations/` (Supabase CLI). Una barbería nueva se levanta con `supabase db push`.
- **Supabase free pausa proyectos tras ~7 días sin actividad** → endpoint `/api/health` que hace una consulta liviana + ping diario (cron externo gratuito o GitHub Actions).

---

## 4. Modelo de datos

Tablas en Supabase (PostgreSQL). Nombres en inglés.

### `barbers`
- `id` (uuid, pk) · `name` (text) · `active` (bool, default true)

> V1 tiene un solo barbero. Se mantiene la tabla y los `barber_id` para poder crecer sin rehacer el esquema.

### `services`
- `id` (uuid, pk) · `name` (text) · `duration_min` (int) · `price_clp` (int) · `active` (bool) · `sort_order` (int)

### `working_hours` (horario regular)
- `id` · `barber_id` (fk) · `weekday` (int, 0=domingo … 6=sábado) · `start_time` (time) · `end_time` (time)
- Varios tramos por día permitidos (así se modela la colación: 10:00–14:00 y 14:30–19:00).

### `time_off` (feriados, vacaciones, horas puntuales)
- `id` · `barber_id` (fk) · `starts_at` (timestamptz) · `ends_at` (timestamptz) · `reason` (text, nullable)

### `appointments`
- `id` (uuid, pk) · `barber_id` (fk) · `service_id` (fk)
- `customer_name` (text) · `customer_phone` (text, normalizado +569…)
- `starts_at` (timestamptz) · `ends_at` (timestamptz)
- `status` (enum: `pending` | `confirmed` | `cancelled` | `completed` | `no_show`, default `confirmed`)
- `cancel_token` (uuid, único, para que el cliente cancele desde su link)
- `created_at` (timestamptz, default now())

**Regla anti-doble-reserva (crítica):**
- **Constraint de exclusión** (no un UNIQUE): `EXCLUDE USING gist (barber_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status NOT IN ('cancelled','no_show'))` con la extensión `btree_gist`. Impide **cualquier solapamiento**, incluso con servicios de distinta duración.
- La reserva se crea vía **función RPC** (`book_appointment`, `security definer`) que valida reglas + inserta en una operación. Si dos clientes chocan, el constraint rechaza al segundo.

**Seguridad (RLS):**
- RLS activado en todas las tablas.
- Público (anon): lee `services` activos; **no** lee ni inserta en `appointments` directamente. Solo vía RPC: `get_available_slots` (devuelve horas, sin datos personales), `book_appointment`, `cancel_appointment(token)`.
- Admin autenticado: acceso completo.

**Zona horaria:** `America/Coyhaique` (Aysén, UTC-3 todo el año desde 2025). Se guarda en `timestamptz`; todo cálculo de "hoy" y de horas se hace en esa zona (configurable por barbería).

---

## 5. Lógica de slots

- **Grilla fija de 30 minutos** (configurable). Para cada inicio posible se verifica que el servicio **quepa completo** dentro de un tramo de `working_hours`, sin chocar con citas activas ni `time_off`.
- Ej: servicio de 60 min, tramo 10:00–14:00 → 10:00, 10:30 … 13:00 (si están libres).
- Se calcula en SQL (función `get_available_slots`) con índice sobre `(barber_id, starts_at)`.

---

## 6. Reglas de negocio (confirmadas)

| Regla | Valor |
|-------|-------|
| Servicios | **Corte** 60 min · $10.000 — **Corte + barba** 60 min · $15.000 — **Barba** 60 min · $7.000 |
| Días de atención | **Lunes a sábado** |
| Horario | **10:00–19:00** |
| Colación | **14:00–14:30** |
| Teléfono | +56 9 2631 1837 |
| Anticipación mínima | **1 hora** antes |
| Ventana de reserva | Hasta **14 días** hacia adelante |
| Confirmación | **Automática** (estado `confirmed`); el barbero puede cancelar desde el panel |
| Cancelación por cliente | **Sí**, desde el link de su reserva (hasta 1 h antes) o llamando |
| Anti-abuso | Máx. 2 citas futuras por teléfono · campo honeypot · validación de teléfono chileno |

---

## 7. Funcionalidades

### Flujo Cliente (público, sin login)
1. Ver servicios (nombre, duración, precio).
2. Elegir fecha (próximos 14 días, solo lunes–sábado habilitados).
3. Ver horas disponibles.
4. Reservar con **nombre + teléfono**.
5. Confirmación con resumen + botón **"Guardar en WhatsApp"** + link para cancelar.
6. Página `/cita/[token]`: ver y cancelar la reserva.

### Panel Admin (login)
1. Login (Supabase Auth, email/clave).
2. Agenda día / semana.
3. Crear / editar / cancelar citas manualmente (clientes que llaman).
4. Gestionar servicios, horarios y bloqueos.
5. Marcar cita como `completed` o `no_show`.

### No funcionales
- Mobile-first, botones grandes, pocos pasos.
- PWA instalable (manifest, service worker, íconos desde el logo).
- Prevención de doble reserva (constraint de exclusión + RPC).
- Costo operativo $0 en capas gratuitas.

---

## 8. Plan por fases

**Fase 1 — Setup** ✅ Next.js + TS + Tailwind v4, paleta y tipografías, clientes Supabase, `netlify.toml`, config por barbería.
**Fase 2 — Base de datos** ✅ Migraciones SQL (tablas, constraint de exclusión, RLS, RPCs), seed (1 barbero, 3 servicios, horario L–S 10:00–19:00 con colación 14:00–14:30).
**Fase 3 — Flujo de reserva** ✅ servicios → fecha → hora → datos → confirmación, + cancelación por token.
**Fase 4 — Panel admin** ✅ Auth + rutas protegidas, agenda, CRUDs.
**Fase 5 — PWA + branding** ✅ manifest, íconos 192/512 + maskable, service worker, prueba Android/iOS.
**Fase 6 — Deploy** ✅ Netlify + Supabase producción + cron anti-pausa + prueba en móvil real.
**Fase 7 — Opcional** (recordatorio por WhatsApp ✅ manual desde la agenda · reportes ✅) Email (Resend), recordatorios WhatsApp, reportes.

---

## 9. Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # solo servidor, nunca exponer
NEXT_PUBLIC_SITE_URL=           # URL pública (links de cancelación)
NEXT_PUBLIC_BUSINESS_PHONE=     # teléfono de la barbería (formato 569XXXXXXXX)
RESEND_API_KEY=                 # opcional
```

---

## 10. Entregable y modelo de negocio (contexto, no a desarrollar)

- Se vende como **servicio**: cobro inicial + mensualidad.
- Referencial CLP: instalación ~$150.000 + mensualidad ~$20.000, o pago único ~$250.000–$500.000.
- Replicable a otras barberías (ver "Portabilidad").
- Pieza de portafolio.

---

## Pendientes por confirmar
- Precios confirmados ($10.000 / $15.000 / $7.000); se editan desde el panel admin (Fase 4).
