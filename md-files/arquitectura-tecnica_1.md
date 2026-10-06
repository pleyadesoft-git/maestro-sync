# Arquitectura Técnica — MVP
### App de Lectura Sincronizada de Partituras

> Alcance de este MVP: **sin OMR**. El marcado de pentagramas/renglones para el highlight
> se hace de forma **manual** al subir la partitura (el propio usuario define cuántos
> compases tiene cada renglón). El OMR automático (Audiveris/oemer/Halbestunde) queda
> para una versión posterior, tal como se definió en el plan funcional.

---

## 1. Estructura del monorepo (Turborepo)

```
music-sync/
├── apps/
│   ├── web/                 # App principal (Next.js) — Director + Ejecutante
│   ├── admin/                # Panel de administración (Next.js separado)
│   └── landing/              # (opcional futuro) Landing/marketing, separado de la app autenticada
├── packages/
│   ├── ui/                   # Componentes compartidos (ShadCN + Tailwind + Framer Motion)
│   ├── supabase/              # Cliente Supabase tipado, queries compartidas, tipos generados
│   ├── stores/                # Stores de Zustand compartidos (sesión, playback, auth)
│   ├── i18n/                  # Diccionarios y configuración de next-intl
│   ├── stripe/                 # Helpers de Stripe compartidos entre web y admin
│   └── config/                # eslint, tsconfig, tailwind config base
├── turbo.json
├── package.json               # workspaces (pnpm)
└── pnpm-workspace.yaml
```

**Por qué monorepo:** `web` y `admin` comparten tipos de Supabase, componentes UI base y lógica de Stripe. Turborepo cachea builds y permite desarrollar ambas apps en paralelo sin duplicar código. Gestor de paquetes recomendado: **pnpm** (más rápido y eficiente en espacio que npm/yarn para monorepos).

---

## 2. Stack por capa

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | Next.js (App Router, última estable) | SSR para SEO en landing, CSR para la app interactiva |
| Estilos | Tailwind CSS | Config compartida en `packages/config` |
| Componentes | ShadCN/UI | Instalados localmente en `packages/ui`, no como dependencia externa |
| Animación | Framer Motion | Transiciones del highlight y navegación |
| Estado cliente | **Zustand** | Stores separados por dominio (ver sección 4) |
| Backend/DB | Supabase (Postgres + Auth + Storage + Realtime) | Esquema ya definido en `schema.sql` |
| Pagos | Stripe | Checkout + Customer Portal + Webhooks |
| Email admin | Nodemailer + SMTP de Gmail (App Password) | Fase inicial; migrar a Resend si el volumen crece |
| i18n | next-intl | Rutas localizadas `/[locale]/...` |
| PWA | `@ducanh2912/next-pwa` (compatible con App Router) | Service worker con estrategia network-first para HTML, cache-first para assets estáticos |
| Auth biométrica | WebAuthn nativo del navegador + Supabase Auth (passkeys) | No requiere librería adicional pesada |

---

## 3. Autenticación y Passkeys

- Supabase Auth maneja Google, Apple y email/password de forma nativa.
- Para **Passkeys/WebAuthn**: Supabase Auth soporta autenticación con passkeys como método adicional vinculado a la cuenta del usuario. El flujo:
  1. Usuario inicia sesión una primera vez con Google/Apple/email.
  2. Desde su perfil, activa "Inicio rápido con Face ID / Touch ID" → se registra una credencial WebAuthn (`navigator.credentials.create`) asociada a su `user.id`.
  3. En sesiones futuras, la app detecta si el dispositivo soporta biometría y ofrece el botón de acceso rápido (`navigator.credentials.get`).
- Middleware de Next.js protege las rutas de `apps/web` (`/session/*`, `/library/*`) verificando el JWT de Supabase en cada request.

---

## 4. Manejo de estado (Zustand)

Stores propuestos, todos en `packages/stores`, consumidos tanto por `web` como (parcialmente) por `admin`:

```
stores/
├── useAuthStore.ts        # usuario actual, perfil, idioma preferido
├── useLibraryStore.ts      # partituras cargadas, filtros activos (obra/autor/fecha/referencia)
├── useSessionStore.ts      # sesión activa: room_code, rol (director/performer), participantes
├── usePlaybackStore.ts     # estado de reproducción: status, tempo_bpm, current_measure, playback_started_at
└── useUploadStore.ts       # progreso de subida y marcado manual de pentagramas
```

**`usePlaybackStore` es el más crítico** porque debe mantenerse sincronizado con el canal de Supabase Realtime. Se recomienda que el store solo refleje el último estado recibido del canal (fuente de verdad = servidor/Realtime), y que el cálculo de "en qué compás vamos ahora mismo" se derive localmente a partir de `playback_started_at` + `tempo_bpm`, no de eventos discretos repetidos — esto evita drift entre dispositivos con distinta latencia de red.

---

## 5. Sincronización en tiempo real (Supabase Realtime)

### 5.1 Canal por sesión
- Canal: `session:{session_id}`
- Tipo de mensajes:
  - `broadcast` para eventos de control (play/pause/stop/seek/tempo).
  - `presence` para saber quién está conectado y con qué instrumento.

### 5.2 Contrato de eventos (broadcast)

```ts
type PlaybackEvent =
  | { type: "play"; measure: number; tempo_bpm: number; server_time: string }
  | { type: "pause"; measure: number; server_time: string }
  | { type: "stop" }
  | { type: "seek"; measure: number; server_time: string }
  | { type: "tempo_change"; tempo_bpm: number; server_time: string }
  | { type: "director_transfer"; new_director_user_id: string };
```

- `server_time` se usa como referencia de reloj para que cada cliente calcule su propio avance del highlight, compensando la latencia de red (diferencia entre `server_time` y el reloj local del cliente).
- Todo evento también se persiste en la tabla `sessions` (columna `status`, `tempo_bpm`, `current_measure`, `playback_started_at`) vía una función RPC de Supabase — esto es lo que permite la **reconexión**: un cliente que se cae y vuelve simplemente hace un `select` a `sessions` + `session_participants` para reconstruir el estado, sin depender de haber "perdido" un evento de broadcast.

### 5.3 Transferencia de rol de Director
- Se implementa como una función **RPC `transfer_director(session_id, new_director_id)`** con `security definer`, que:
  1. Verifica que quien la invoca sea el Director actual, o que el Director esté marcado como desconectado (vía `presence`) y quien invoca sea un participante activo.
  2. Actualiza `sessions.director_user_id` de forma atómica.
  3. Emite el evento `director_transfer` al canal.
- Esto evita condiciones de carrera si dos ejecutantes intentan tomar el control al mismo tiempo (gana el primer `UPDATE` confirmado por Postgres).

### 5.4 Presence
- Cada cliente anuncia su presencia con `{ user_id, instrument_id, role }`.
- El Director ve en su UI la lista de conectados y sus instrumentos en tiempo real (útil para detectar si falta algún músico antes de dar play).

---

## 6. Highlighting sincronizado (cliente)

- Cada `score_system` (pentagrama) tiene `measure_start` y `measure_count`.
- Duración estimada del pentagrama en segundos = `(measure_count * beats_per_measure * 60) / tempo_bpm` (usando el `time_signature` de la obra).
- El cliente arma al cargar la sesión una **línea de tiempo local** (array de `{ system_id, start_offset_seconds, end_offset_seconds }`) calculada una sola vez a partir del tempo vigente.
- En cada `requestAnimationFrame` (o intervalo de ~100ms), el cliente calcula `elapsed = now - playback_started_at` y determina qué `system_id` debe estar resaltado — así el highlight es fluido y no depende de recibir un evento por cada pentagrama.
- Si cambia el tempo en vivo (`tempo_change`), se recalcula la línea de tiempo restante a partir del compás actual, sin reiniciar desde el principio.

---

## 7. Subida y marcado manual de partituras (sin OMR en este MVP)

Flujo de subida:
1. Usuario sube PDF/imagen → se almacena en Supabase Storage (`scores` bucket, path privado por usuario).
2. Se generan renders de cada página (usando `pdf.js` en el cliente o una función Edge de conversión) → se guardan en `score_pages`.
3. **Editor de marcado manual simple:** sobre cada página renderizada, el usuario dibuja rectángulos (drag simple, no requiere precisión milimétrica) para marcar cada pentagrama, e indica:
   - A qué instrumento pertenece (si es partitura general).
   - Cuántos compases contiene ese pentagrama.
4. Esto llena directamente la tabla `score_systems` con `is_manually_corrected = true`, sin pasar por `omr_jobs` en este MVP (esa tabla queda lista en el esquema para cuando se active el OMR en una fase posterior).

Esto simplifica mucho el MVP: no hay procesamiento asíncrono pesado, no hay microservicio de OMR que hospedar, y el usuario tiene control total desde el día uno sobre la precisión del highlight.

---

## 8. Internacionalización (i18n)

- `next-intl` con rutas `/[locale]/...`.
- Diccionarios base en `packages/i18n/messages/{es,en,zh,hi,fr,ar,pt,bn,ru,ja,de}.json`.
- Para el MVP se recomienda lanzar completamente traducido solo en **es/en**, y dejar el resto de idiomas con fallback a inglés hasta contar con traducciones revisadas (evita mostrar textos a medio traducir o generados automáticamente sin revisión).

---

## 9. PWA

- Manifest con iconos adaptativos, `display: standalone`.
- Service worker: cachea shell de la app y assets estáticos; las páginas de partituras (imágenes) se cachean bajo demanda (para permitir lectura offline de partituras ya abiertas), pero la sincronización en vivo requiere conexión.
- Actualizaciones automáticas: estrategia de "nueva versión disponible" con `skipWaiting` + notificación discreta al usuario para recargar, evitando interrumpir una sesión de ejecución en curso (no forzar reload si hay una sesión activa con `status = playing`).

---

## 10. Stripe — flujo de suscripciones

1. `apps/web` usa Stripe Checkout (modo `subscription`) para plan individual u organizacional (con `quantity` = asientos si aplica).
2. Webhook (`/api/webhooks/stripe`, en `apps/web` o en una función Edge de Supabase) escucha:
   - `checkout.session.completed` → crea/activa registro en `subscriptions`.
   - `customer.subscription.updated` → sincroniza estado (`active`, `past_due`, `canceled`).
   - `customer.subscription.deleted` → marca `status = canceled`.
3. El webhook usa la **service_role key** de Supabase (nunca expuesta al cliente) para escribir en `subscriptions`, evitando así que un usuario pueda auto-otorgarse una suscripción activa.
4. Cliente accede al **Customer Portal de Stripe** para autogestionar cancelación/cambio de plan.

---

## 11. Panel de administración — arquitectura (adelanto, se detalla en el siguiente documento)

- App separada `apps/admin`, mismo monorepo, mismo proyecto de Supabase pero con políticas RLS distintas (solo accesible si `profiles.is_platform_admin = true`).
- Notificación en tiempo real vía canal de Supabase Realtime (`admin_notifications`) + Toast.
- Email vía SMTP de Gmail activado por un trigger de Postgres (`on insert` en `profiles`) que invoca una Edge Function.

---

## 12. Despliegue

| Componente | Plataforma recomendada | Motivo |
|---|---|---|
| `apps/web` y `apps/admin` | **Vercel** | Integración nativa con Next.js, preview deployments por PR, Edge Functions |
| Supabase (DB/Auth/Storage/Realtime) | **Supabase Cloud** | Ya definido en el plan |
| Emails transaccionales | Edge Function de Supabase + SMTP Gmail | Fase inicial, bajo volumen |

*(El microservicio de OMR, al quedar fuera del MVP, no requiere infraestructura adicional por ahora. Cuando se active en una fase futura, se evaluará Railway/Fly.io como se discutió.)*

---

## 13. Variables de entorno clave (referencia)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo en server/webhooks, nunca en cliente
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
```

---

**Siguiente paso:** panel de administración (modelo de datos ya cubierto en `schema.sql`, sección 5) — pantallas, flujos y notificaciones en tiempo real. Documento a continuación.
