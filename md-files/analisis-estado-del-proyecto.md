# ANÁLISIS DE ESTADO DEL PROYECTO — MAESTROSYNC (MUSIC-FLOW)

> **Fecha del análisis:** 09 de octubre de 2026
> **Alcance:** revisión completa del monorepo (apps, packages, esquema SQL, documentación).
> **Método:** lectura íntegra de todo el código fuente versionado, comparación contra `supabase/schema.sql`, verificación de tipos con `tsc --noEmit` y contraste con lo declarado en `AGENTS.md` / `md-files/*`.
> **Este documento es solo diagnóstico y plan; no modifica código.**

---

## ✅ CORRECCIONES APLICADAS (post-análisis, 09/10/2026)

Las fases 0 y 1 del plan, más la conexión de las páginas MVP a Supabase, ya están implementadas y verificadas con `pnpm lint`, `pnpm typecheck` y `pnpm build` (web y admin) en verde:

| Área | Corrección |
|---|---|
| Tipos Supabase | `Relationships: []` en las 16 tablas + bloque `Functions` (`create_session`, `join_session`, `transfer_director`, `leave_session`, `is_platform_admin`) → `.rpc()` y `.from()` vuelven a validar en tiempo de compilación. |
| Cliente | Singleton en `createBrowserClient()` (elimina el bucle de re-suscripción Realtime), `createAuthedClient(token)` para server actions, `/server` fuera del barrel público, `.env.example` y scripts `typecheck` en todos los paquetes/apps. |
| Esquema SQL | RLS en `instruments`/`plans`, `is_platform_admin()` `security definer`, políticas de escritura de `session_participants`, lectura de la cadena de partituras para participantes, triggers anti-manipulación de `profiles`, GRANTs por columna; RPCs `create_session`/`join_session`/`transfer_director`/`leave_session`; migración idempotente `supabase/migrations/0001_security_fixes.sql`. |
| `/session/[code]` | Rol derivado de BD (no query param), unión vía RPC `join_session`, anti-drift por ancla temporal (re-anclaje en tempo/seek), persistencia del estado de playback en `sessions`, cleanup con `leave_session`, controles solo-director. |
| `/login` | Eliminado el fallback `mock-user-123`; registro real (`signUp`), passkey vía `signInWithPasskey()` de auth-js, errores legibles. |
| `/` (Home) | "Crear Sala Inmediata" usa la RPC `create_session` (código real en BD); validación del formato del código de sala; sin anidamiento inválido `Link>Button`. |
| `/library` | Conectada a Supabase: obras reales del usuario, filtros por compositor y **tonalidad**, estados vacío/anónimo/error, "Iniciar Sala" vía `create_session`. |
| `/upload` | Persistencia completa: Storage (`scores`) + `works → work_versions → scores → score_pages → score_systems`, límite de 2 partituras del plan gratuito, limpieza best-effort ante fallos, entradas de tonalidad/compás/total de compases. |
| Admin | Server actions con verificación de token + `is_platform_admin`, overview real, suspensión real con log de `moderation_actions`. |
| Stripe | Webhook implementado (`checkout.session.completed`, `customer.subscription.*`) con upsert en `subscriptions` y notificaciones admin. |
| Fase 7 (mínima) | `error.tsx`, `loading.tsx` y `not-found.tsx`; fuga de listeners corregida en `PWAUpdateNotification`. |

**Pendiente (ver plan de §6):** i18n real (`useTranslations`), `time_signature` derivado de la obra en el loop de sesión, render de `score_pages` en la sala, multi-página en `/upload`, checkout Stripe por usuario, y las fases de OMR y testing.

---

## 1. PROPÓSITO DEL PROYECTO

**MaestroSync (Music Flow)** es una **PWA de lectura de partituras sincronizada** para orquestas, ensambles y profesores de música:

- **Sala de ejecución en vivo:** un usuario asume el rol de **Director** (control total de Play/Pause/Stop, Seek por compás y Tempo BPM en vivo) y los **Ejecutantes** se unen con un código corto de sala (ej. `MZ7K-2Q`), eligen su instrumento y leen la partitura sincronizada.
- **Sincronización sin drift:** basada en Supabase Realtime (Broadcast + Presence) y cálculo de offset temporal (`playback_started_at` + `tempo_bpm` + `requestAnimationFrame`), **no** en eventos discretos por compás. Todos los clientes derivan el compás actual desde un timestamp único, para que 50 tablets avancen al unísono.
- **Highlight por pentagrama:** cada ejecutante ve la partitura completa pero solo se resalta **su** pentagrama, mediante bounding boxes normalizados (`bbox_x/y/w/h` ∈ 0..1) y auto-scroll.
- **Gestión de obras:** jerarquía `works → work_versions → scores → score_pages → score_systems`, con carga de PDF/imágenes y **marcado manual** de sistemas y compases (MVP sin OMR; OMR reservado para Fase 2).
- **Diseño "Stand-Ready":** modo oscuro de alto contraste (`#0b0f17`, acento ámbar `#f59e0b`), targets táctiles ≥48px, sin zoom accidental, para tablets en atriles con poca luz.
- **Monetización:** planes Stripe (Free con límite de 2 partituras, Individual mensual, Orquesta/Organización), webhook que actualiza `public.subscriptions`.
- **Panel admin** (`apps/admin`, puerto 3001): métricas, notificaciones realtime, moderación de usuarios.

**Stack:** Turborepo + pnpm, Next.js 16.3.8 (App Router, Turbopack), React 19.3, TypeScript 5.8/5.9, Tailwind v4, Zustand, Supabase (Auth/DB/Storage/Realtime), `next-intl`, `pdfjs-dist`, Stripe, Recharts.

---

## 2. ESTADO REAL POR MÓDULO

| Módulo | Estado real | Detalle |
|---|---|---|
| `packages/ui` | ✅ Implementado | `Button`, `Card`, `HighlightOverlay`, `Input`, `MusicScoreSheet`, `cn()`. Barrel completo. |
| `packages/stores` | ✅ Implementado (parcialmente sin uso) | 5 stores; `useLibraryStore` y `useUploadStore` **no se importan en ninguna app**. |
| `packages/supabase` | ⚠️ Implementado, incompleto | 16 tablas tipadas, pero `Database` **sin `Functions`/`Views`** → `.rpc()` inválido y `.from()` deja de validar nombres. |
| `packages/i18n` | ⚠️ Diccionarios listos, **sin usar** | 54 claves × 2 idiomas, paridad perfecta, pero **cero llamadas a `useTranslations`** en todo el repo. |
| `packages/stripe` | ⚠️ Código muerto | `PLANS_CONFIG` exportado pero jamás consumido. |
| `packages/config` | ❌ Entrada rota | Declara `"main": "index.js"` y **el archivo no existe**. |
| Home ` /[locale] ` | ⚠️ Prototipo | "Crear Sala" genera código con `Math.random()` en cliente; **nunca inserta en `sessions`**. |
| `/login` | ❌ Falso | Fallback a `mock-user-123` ante **cualquier** error de auth; passkey **no llama a WebAuthn**. Sin registro. |
| `/library` | ❌ Mock | Array `MOCK_WORKS` hardcodeado; **cero consultas a Supabase**; no existe filtro de tonalidad. |
| `/upload` | ⚠️ Prototipo | Previsualiza página 1 con `pdfjs-dist`; editor de marcado sobre 4 sistemas pre-cargados; **"Guardar" no persiste nada**. |
| `/session/[code]` | ⚠️ Prototipo con bugs graves | Realtime y rAF activos, pero con bucle de suscripción, anti-drift roto y rol por query param (§3). |
| `/api/webhooks/stripe` | ⚠️ Mitad | Verificación de firma ✅ correcta; **handler completamente vacío** (solo `break`). |
| `apps/admin` | ❌ Semi-funcional | Sin guard de admin, sin login, métricas bloqueadas por RLS, MRR y "Top partituras" **inventados**, Recharts sin usar. |
| `supabase/schema.sql` | ⚠️ Sólido pero con agujeros críticos | 14/16 tablas con RLS; faltan `plans` e `instruments`; políticas peligrosas (§3.1). |
| PWA | ⚠️ Funcional con deuda | Banner de actualización ok, pero `public/sw.js` es un artefacto **obsoleto** de un build webpack y el worker de PDF se carga desde CDN. |
| i18n (rutas) | ✅ Cableado | `proxy.ts` (nombre correcto para Next 16), `request.ts`, `NextIntlClientProvider`. |

---

## 3. BUGS Y HALLAZGOS ENCONTRADOS

### 3.1 🔴 CRÍTICOS — Seguridad de base de datos

**C1. `plans` e `instruments` sin RLS (16 tablas creadas, solo 14 con `enable row level security`).**
- `supabase/schema.sql` crea `instruments` y `plans` pero no les habilita RLS ni define políticas. Sin `revoke`/`grant` explícitos, **cualquier usuario anónimo puede modificar el catálogo de facturación** (`stripe_price_id`, `seats_included`, `is_active`) y el catálogo de instrumentos.

**C2. Escalada de privilegios vía `profiles_update_own`.**
```sql
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());   -- SIN with check
```
Sin `with check` ni restricción de columnas, un usuario **puede escribir `is_platform_admin = true` en su propia fila**, lo que destraba todas las políticas de administración (`profiles_select_own_or_admin`, `admin_notifications_admin_only`, `moderation_actions_admin_only`).

**C3. `is_platform_admin()` no es `SECURITY DEFINER` y se invoca desde una política de la misma tabla.**
- La función consulta `profiles` y es llamada por una política sobre `profiles` → clásico riesgo de **recursión infinita (error 42P17)**. Además no es `security definer`, a diferencia de lo que el propio repo exige para `transfer_director`.

**C4. La RPC `transfer_director(session_id, new_director_id)` NO existe.**
- `supabase/schema.sql:360-362` contiene **solo un comentario** que la menciona. No hay `create function public.transfer_director` en ninguna parte (funciones existentes: `set_updated_at`, `is_platform_admin`), ni ninguna llamada `.rpc()` en el código. **No existe forma legítima de transferir la dirección de una sesión**, y la política `sessions_director_all` impide a cualquiera más que el director actual escribir.

**C5. `createServiceRoleClient()` se empaqueta en bundles de navegador.**
- `packages/supabase/index.ts` hace `export * from './server'`, de modo que cualquier `import { createBrowserClient } from '@music-flow/supabase'` arrastra `server.ts` al grafo del cliente. Visible en el build commiteado de `apps/admin`. La clave real **no se filtra** (no es `NEXT_PUBLIC_*`), pero viola la regla propia del repo.

**C6. Ningún cliente puede crear la sesión ni unirse a ella bajo RLS.**
- `sessions` solo tiene `sessions_director_all` (exige ser director) y `sessions_participant_select` (exige **ya ser** participante). La consulta por `room_code` del ejecutante que se une **siempre devuelve 0 filas**. Igualmente, `score_systems` es inaccesible para no-owner → la sesión cae siempre al fallback mock.
- **No existe ningún `insert` en `sessions` en toda la app.**

**C7. `session_participants_self_all` permite corromper roles.**
- `for all using (user_id = auth.uid()) with check (user_id = auth.uid())` → cualquier usuario autenticado puede insertarse en cualquier sesión conociendo su UUID y **actualizar su propio `role` a `'director'`**.

**C8. Falta el onboarding de perfiles.**
- No hay trigger `on auth.users` que cree la fila en `public.profiles`, ni política `insert` sobre `profiles`. Como `works.owner_id` referencia `profiles`, **un usuario recién registrado no puede crear obras desde el cliente**.

### 3.2 🟠 ALTOS — Bugs funcionales

**A1. Bucle infinito de suscripción Realtime (sesión y admin).**
- `createBrowserClient()` **no es singleton** (`packages/supabase/client.ts:4-9` crea uno nuevo en cada llamada) y se invoca en el cuerpo del componente:
  - `apps/web/app/[locale]/session/[code]/page.tsx:58`
  - `apps/admin/app/page.tsx:26`
- El objeto nuevo cambia en cada render → los `useEffect` con `[supabase]` en dependencias se re-ejecutan → `removeChannel`/re-suscripción/re-track de presencia en bucle. En admin, `setStats({...})` con objeto nuevo garantiza el ciclo: **peticiones de red indefinidas**.

**A2. El broadcast del director sale por un canal huérfano.**
- `broadcastPlayback` hace `supabase.channel(...).send(...)` sobre un cliente desechable distinto al suscrito → `canPush()` es falso y supabase-js **cae al deprecated REST broadcast**, creando un canal huérfano por cada llamada.

**A3. La matemática anti-drift viola la especificación.**
```ts
const secondsPerMeasure = (4 * 60) / tempoBpm      // 4/4 hardcodeado
const measuresAdvanced = Math.floor(elapsedSeconds / secondsPerMeasure)
const newMeasure = 1 + (measuresAdvanced % 16)     // wrap a 16 compases
```
- Ignora `timeSignatureBeats` (existe en el store), ignora el compás actual y **no usa `playbackStartedAt`** recibido: el cálculo siempre arranca en el compás 1, de modo que **reanudar después de una pausa reinicia la obra desde el compás 1** y el Seek queda anulado en el siguiente frame.
- El ejecutante ancla en su propio primer `requestAnimationFrame` en lugar del `playbackStartedAt` recibido → la latencia de red **no se compensa**.
- Cambio de tempo solo re-inicia el loop con el nuevo `secondsPerMeasure` sobre el transcurso total acumulado: no re-ancla desde el compás actual (requisito explícito de `AGENTS.md` §4.4) y provoca un salto.
- `broadcastPlayback` aplica `setPlayback(...)` **incluso en el ejecutante** (`session/page.tsx:152-154`), y los botones de Seek **no están deshabilitados para él** (`:319,352`, a diferencia de play/pause/stop en `:328,336,345`) → un performer puede desincronizar su vista local.

**A4. El rol "director" se controla por query param.**
- `role` del store **nunca se asigna** (`setSession` no se llama en ninguna parte); el director real depende de `?role=director` en la URL → cualquier visitante se declara director. Sin autorización servidor.

**A5. Login presenta el fallo como éxito.**
- Cualquier error de `signInWithPassword` (contraseña incorrecta, red caída, claves inválidas) dispara `setAuth({id:'mock-user-123'})` y navegación a la biblioteca (`login/page.tsx:43-58,64-67`). El botón de passkey muestra "Acceso con Passkey exitoso" **sin ninguna ceremonia WebAuthn** (`:73-96`); su `catch` no contiene `await` → código muerto. No existe flujo de registro.

**A6. Admin suspende 0 filas pero muestra éxito.**
- `update({is_suspended}).eq('id', userId)` sobre **otro** usuario, con solo la política `profiles_update_own` → 0 filas afectadas; el error se ignora y el estado local ya mutó optimistamente. `insert` en `moderation_actions` falla igual (`admin_id` es `not null` y vendría `undefined` sin sesión).

**A7. El webhook de Stripe no hace nada.**
- Firma verificada correctamente (`route.ts:15`), pero ambos `case` solo hacen `break`; el cliente service-role creado en `:20` no se usa. **Ninguna suscripción se actualiza nunca.**

**A8. `/upload` no persiste nada.**
- `handleSaveScore` solo hace `router.push(.../library)`: sin `insert` en `works/work_versions/scores/score_pages/score_systems`, sin subida a Storage, sin `is_manually_corrected`. Tampoco se valida el límite de 2 partituras del plan Free (requisito de `AGENTS.md`).

**A9. El panel admin no tiene ningún guard.**
- No existe `middleware.ts` ni `proxy.ts` en `apps/admin`, ni mención de `is_platform_admin` en su código: **cualquiera que abra el puerto 3001 ve el dashboard completo** (los datos, vacíos por RLS, sí están protegidos). Contradice `md-files/panel-administracion.md:12`.

### 3.3 🟡 MEDIOS — Infraestructura y calidad

| # | Hallazgo | Referencia |
|---|---|---|
| M1 | **Cadena de tsconfig rota en los 5 paquetes**: `extends: @music-flow/config/tsconfig.base.json` pero ningún paquete lo declara como dependencia → `tsc -p packages/*` falla con `TS6053` y el `strict` no aplica. | `packages/*/tsconfig.json:2` |
| M2 | `@music-flow/supabase` sin `@types/node` → `TS2580: Cannot find name 'process'` al chequear el paquete aislado (las apps lo enmascaran). | `packages/supabase/package.json` |
| M3 | `Database` sin `Functions` → `.rpc('transfer_director', …)` no compila y `.from('tabla_inexistente')` **no marca error**. | `packages/supabase/types.ts:9` |
| M4 | **i18n sin usar:** cero `useTranslations` en `apps/*`; todos los textos están hardcodeados en español, incluidos mensajes de error (que usan `e.target.validationMessage` del navegador). Viola la regla 8 de `AGENTS.md`. | `apps/web/**` |
| M5 | `proxy.ts` re-declara `locales: ['es','en']` en lugar de importarlos de `@music-flow/i18n` (duplicación de fuente de verdad). | `apps/web/proxy.ts:4-5` |
| M6 | **Sin `error.tsx`, `loading.tsx`, `not-found.tsx`** en toda la app: un fallo de Supabase/Realtime no tiene frontera de error. | `apps/web/app/**` |
| M7 | `useSearchParams()` sin `<Suspense>` → **falla de build latente** en cuanto se añada prerender de locales. | `session/[code]/page.tsx:42` |
| M8 | `next.config.js` define un hook `webpack` (`resolve.alias.canvas = false` para pdfjs) **ignorado por Turbopack** (se silencia con `turbopack: {}`). | `apps/web/next.config.js:24-28` |
| M9 | Worker de PDF cargado desde **cdnjs CDN** → rompe el modo offline de la PWA y añade dependencia externa. | `upload/page.tsx:58` |
| M10 | `public/sw.js` commiteado es un artefacto **obsoleto** de un build webpack (precachea `/_next/static/webpack-*.js`). | `apps/web/public/sw.js` |
| M11 | Fuga en el cleanup del banner PWA: el `clearInterval`/`removeEventListener` se devuelve dentro del callback de `serviceWorker.ready.then(...)`, **nunca se ejecuta**. | `PWAUpdateNotification.tsx:109-113` |
| M12 | `moderation_actions.admin_id` **sin `on delete`** → bloqueará el borrado de un usuario que haya moderado algo. | `schema.sql:245` |
| M13 | `is_suspended` se añade en schema pero **no se usa en ninguna política ni función** (no bloquea nada). | `schema.sql:253-254` |
| M14 | **Cero `alter publication supabase_realtime add table`** en el schema → los `postgres_changes` del admin no funcionarán. | `supabase/schema.sql` |
| M15 | Sin seeds: `plans` e `instruments` vacíos; además `schema.sql` dice `'org_10_annual'` y el código `'org_annual'`. | `schema.sql:202` vs `packages/stripe/index.ts:23` |
| M16 | Los clientes Supabase/Stripe **fallan silenciosamente a placeholders** en vez de fallar rápido si falta una variable de entorno. | `client.ts:5-6`, `server.ts:5-6`, `stripe/index.ts:4` |
| M17 | `tailwind.config.js` en ambas apps es **código muerto** (Tailwind v4 no lo carga sin `@config`); `@source "../components"` apunta a un directorio inexistente. | `globals.css:3` |
| M18 | Sin `scripts` en ningún `packages/*/package.json` → `pnpm build`/`pnpm lint` raíz solo corre tareas de `apps/*`. | `package.json` |

### 3.4 🟢 BAJOS — Higiene del repo

- **`agents_sample.md` (31 KB) es el AGENTS.md de OTRO producto** ("SM RESTAURANT PRO", app de restaurante/POS) dejado en la raíz: puede confundir a cualquier agente que lea los `*.md`.
- `README.md` tiene **41 bytes** (solo el título) y permisos `600` (el resto de archivos, `644`).
- `.gniignore` duplica parcialmente `.gitignore` para una herramienta no identificada.
- `DATABASE_URL` está en los tres `.env` pero **no aparece en ningún código ni documento**.
- **No existe `.env.example`** (aunque `.gitignore` tiene la excepción `!.env.example`).
- Imports y estado muertos: `Music/Crown/Volume2/Settings` y `setTempo/setStatus/setSession` en la sesión; `Layers/Music/Sliders/Eye/FileText/Sparkles` y `totalMeasures` en upload; `PLANS_CONFIG` y `recharts` sin usar.
- `.env*` está correctamente ignorado por git en las dos pasadas de `.gitignore` (verificado con `git check-ignore`; **ningún secreto está trackeado**).
- Artifacts de build (`apps/admin/.next/`, `.turbo/`) presentes en disco; el `.gitignore` mezcla rutas ancladas (`/.next/`) y sin anclar (`.next/`).
- `apps/admin/.eslintrc.json` (legacy) convive con `eslint.config.mjs` (flat).

---

## 4. BRECHAS ENTRE DOCUMENTACIÓN Y REALIDAD

| # | Afirmación en la documentación | Realidad verificada |
|---|---|---|
| 1 | `AGENTS.md`: "Passkeys… vía `navigator.credentials.get`" | 0 ocurrencias de `navigator.credentials`; el botón es un mock. No hay OAuth de Google/Apple ni registro. |
| 2 | `AGENTS.md`: RPC `transfer_director` con validación atómica | No existe; solo un comentario en el schema. |
| 3 | `AGENTS.md`: "La app crea un registro en `sessions` y genera `room_code`" | No hay ningún `INSERT` en `sessions`; los códigos son `Math.random()` en el navegador. |
| 4 | `AGENTS.md`: biblioteca con filtro por **tonalidad** | Filtro solo por compositor sobre datos mock. |
| 5 | `AGENTS.md`: webhook "actualiza `public.subscriptions`" | Handler vacío. |
| 6 | `AGENTS.md`: webhook, límite de plan free, tempo re-anclado | Ninguno implementado. |
| 7 | `AGENTS.md`: "Recharts — gráficas analíticas en `apps/admin`" | `recharts` instalado, **0 imports**; no hay ninguna gráfica. |
| 8 | `AGENTS.md` estructura: admin con tabs "Suscripciones" y "Moderación" | Solo 2 tabs renderizados (Overview, Usuarios); el estado declara un tercero que nunca se pinta. |
| 9 | `panel-administracion.md:12`: "Middleware de `apps/admin` verifica `is_platform_admin`" | No existe middleware ni proxy en `apps/admin`. |
| 10 | `panel-administracion.md:100`: críticas vía Server Actions | Todo es client-side con Supabase. |
| 11 | `arquitectura-tecnica_1.md:102`: persistencia de cada broadcast vía RPC | No existe tal función. |
| 12 | `panel-administracion.md:56-61`: trigger `after insert on profiles` → notificación + email | No hay trigger sobre `profiles`. |
| 13 | `arquitectura-tecnica_1.md:144`: diccionarios en 11 idiomas | Solo `es.json` y `en.json`. |
| 14 | `AGENTS.md` "✅ Implementado y Verificado" (library, sesión, upload, passkeys) | Descrito en §2: son prototipos con fallback mock. |
| 15 | Tres nombres distintos en la documentación | Raíz `music-flow`, docs `music-sync`, README `maestro-sync`. |

> **Nota inversa:** `AGENTS.md` subestima el código en un punto — lista "integrar `pdfjs-dist`" como pendiente, pero la carga ya lo usa (`upload/page.tsx:57-60`).

---

## 5. PLAN DE REMEDIACIÓN (POR FASES)

> Orden pensado para desbloquear todo lo demás cuanto antes: **cimientos → seguridad → identidad → sesión → contenido → dinero → panel → pulido**. Cada fase termina con verificación (`pnpm lint`, `tsc --noEmit`, `pnpm dev` manual).

### Fase 0 — Cimientos y config (½ día)
1. Crear `.env.example` con los 6 nombres reales; documentar `DATABASE_URL` o eliminarlo.
2. Fail-fast en `packages/supabase/client.ts|server.ts` y `packages/stripe/index.ts` si faltan variables (en servidor) en vez de placeholders silenciosos.
3. Arreglar la cadena de tsconfig: añadir `"@music-flow/config": "workspace:*"` a los 5 paquetes (o referencias equivalentes).
4. Añadir `@types/node` a `packages/supabase`; añadir `scripts` (`build`/`lint`/`typecheck`) a los paquetes para que Turborepo los cubra.
5. Convertir `createBrowserClient()` en **singleton** (módulo-level memoizado) — corrige A1 de raíz.
6. Higiene: eliminar/archivar `agents_sample.md`, `.gniignore` (si nadie lo usa), `apps/admin/.eslintrc.json`, `.eslintrc` legacy; arreglar permisos/contenido de `README.md`; borrar `public/sw.js` obsoleto (regenerarlo en build).

### Fase 1 — Seguridad de base de datos (1 día) ⚠️ prioridad máxima
1. `alter table public.plans/instruments enable row level security` + políticas de lectura pública y escritura solo service-role/admin.
2. `profiles_update_own`: añadir `with check` y **bloquear columnas sensibles** (aislar `is_platform_admin`/`is_suspended` en una política aparte o usar `revoke update(column)`); revisar `session_participants_self_all` para impedir auto-asignarse `role='director'`.
3. `is_platform_admin()` → `security definer` (y evaluar `set search_path`).
4. Implementar la RPC `transfer_director(session_id, new_director_id)` como `security definer` con validación atómica, y añadirla a `types.ts` bajo `Functions`.
5. Trigger `on auth.users after insert` → insertar en `public.profiles` (+ política `insert` propia).
6. Política de unión por sala: permitir `select` en `sessions` por `room_code` a usuarios autenticados (o RPC `join_session(room_code)`), y que el INSERT de `session_participants` verifique la sesión.
7. `moderation_actions.admin_id` → `on delete set null` (o `cascade`); aplicar `is_suspended` en las políticas de login/escritura si se decide usarlo.
8. Añadir `alter publication supabase_realtime add table admin_notifications, sessions, …`.
9. Dividir el barrel de `@music-flow/supabase`: exportar `server` solo desde un subpath (`@music-flow/supabase/server`) para que salga del grafo del cliente.
10. Seeds: `plans` (alinear `'org_annual'` vs `'org_10_annual'`) e `instruments`.

### Fase 2 — Identidad real (1-2 días)
1. Flujo de **registro** (`signUp`) y eliminar TODO el fallback mock del login (un error debe mostrarse como error).
2. Passkeys reales con WebAuthn (`navigator.credentials.create/get`) o, si no, **quitar el botón** hasta implementarlas.
3. Guards de ruta: `/library`, `/upload`, `/session/*` exigen sesión; `apps/admin` exige sesión + `is_platform_admin` (middleware/proxy).
4. Puente de sesión SSR con `@supabase/ssr` (cookies) para que RLS funcione también en Server Components.

### Fase 3 — Sesión en vivo correcta (2-3 días)
1. **Crear la sesión de verdad:** INSERT en `sessions` con `room_code` único generado en servidor (RPC o Server Action), y guardarlo en el store (`setSession`) en vez de leer `?role=director`.
2. Estabilizar Realtime: canal suscrito único, reutilizar el mismo cliente, deps de efectos correctas (sin `supabase` nuevo por render), payload de presencia que no fuerce re-render infinito; broadcast sobre **el canal ya suscrito**.
3. Corregir el anti-drift: anclar en `playbackStartedAt` recibido, usar `timeSignatureBeats`, `initialMeasure + measuresAdvanced` (sin `% 16`), limpiar `startTimeRef` en pausa/stop, re-anclar el tempo desde el compás actual, deshabilitar Seek para el ejecutante.
4. Persistir el estado de playback en `sessions` para la reconexión descrita en `AGENTS.md`.
5. Implementar la transferencia de director (UI + RPC de la Fase 1).
6. Sincronizar la selección de instrumento con el store y el payload de presencia.

### Fase 4 — Pipeline de carga de partituras (2-3 días)
1. PDF → imágenes por página con `pdfjs-dist` (**worker local**, sin CDN), subida a Supabase Storage.
2. Insertar `works`, `work_versions`, `scores`, `score_pages` y `score_systems` desde el editor (bbox normalizados 0..1, `measure_start`, `measure_count`, `is_manually_corrected = true`).
3. Validar el límite del plan Free (2) antes de subir, usando `PLANS_CONFIG`.
4. `MusicScoreSheet` debe renderizar los `score_systems` reales de la BD en lugar del SVG hardcodeado de la Sinfonía nº 5, respetando `bbox_*`.
5. Conectar `/library` a Supabase (filtros por compositor, tonalidad y catálogo reales) y borrar `MOCK_WORKS`.

### Fase 5 — Stripe funcional (1-2 días)
1. Endpoint de Checkout (Server Action o route) con `getStripeServerInstance()`.
2. Completar el webhook: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed` → upsert en `public.subscriptions` con el cliente service-role.
3. Customer Portal y manejo de `PLANS_CONFIG` en el límite de partituras.

### Fase 6 — Panel admin funcional (1-2 días)
1. Guard de `is_platform_admin` + login en `apps/admin`.
2. Mover críticas (suspender, moderar) a **Server Actions** con service-role y errores visibles (hoy fallan en silencio).
3. Métricas reales (MRR desde `subscriptions`, top de partituras desde `sessions`/`scores`) y sustituir los números hardcodeados.
4. Añadir el tab de Suscripciones y las gráficas con Recharts (o retirar la dependencia).
5. Verificar `postgres_changes` contra la publicación añadida en la Fase 1.

### Fase 7 — Pulido i18n, PWA y robustez (1-2 días)
1. Reemplazar todos los textos hardcodeados por `useTranslations` (los diccionarios ya existen con paridad es/en); importar `locales` compartidos en `proxy.ts`.
2. Añadir `error.tsx` / `loading.tsx` / `not-found.tsx` y envolver `useSearchParams` en `<Suspense>`.
3. PWA offline: worker de PDF local, regenerar `sw.js`, arreglar el cleanup del `PWAUpdateNotification`.
4. Revisar el hook `webpack` de `next.config.js` frente a Turbopack (alias de `canvas` para pdfjs) o validar que el preview de PDF sobrevive al build de producción.
5. Tests mínimos: matemática de playback/anti-drift, políticas RLS (con `supabase test db` o scripts SQL), y un E2E de "crear sala → unirse → reproducir".

---

## 6. VERIFICACIÓN ACTUAL (ESTADO DE TIPOS)

| Objetivo | Comando | Resultado |
|---|---|---|
| `apps/web` | `tsc -p apps/web/tsconfig.json --noEmit --incremental false` | ✅ 0 errores |
| `apps/admin` | idem | ✅ 0 errores |
| `packages/ui`, `stripe`, `i18n` | `tsc` con flags explícitos | ✅ 0 errores |
| `packages/supabase`, `stores` | `tsc` con flags explícitos | ❌ 4× `TS2580: Cannot find name 'process'` |
| `packages/*` vía su propio tsconfig | `tsc -p packages/<pkg>` | ❌ `TS6053` (`@music-flow/config` no resuelve) + `TS5095` |
| Build / lint apps | logs en `apps/*/.turbo/` | ✅ compilación y lint limpios (Next 16.3.8 Turbopack) |

**Conclusión:** el código de aplicación *compila*, pero eso no detecta ninguno de los bugs funcionales ni de seguridad listados en §3 — todos fueron encontrados por revisión estática/manual.

---

## 7. RESUMEN EJECUTIVO

- **La arquitectura y el diseño del monorepo son sólidos** (estructura, tipos, stores, UI, RLS en 14/16 tablas, webhook con firma verificada, proxy de Next 16 correcto).
- **La app es un prototipo visual avanzado, no un producto funcional:** login, biblioteca, carga y panel operan sobre mocks o fallbacks silenciosos; nada se persiste en Supabase.
- **Hay 8 problemas críticos de seguridad** que deben resolverse antes de exponer cualquier entorno: catálogos sin RLS, auto-promoción a superusuario, RPC de transferencia inexistente, service-role empaquetado en cliente y rutas de sesión inaccesibles bajo las políticas actuales.
- **El bug más destructivo en runtime** es el cliente Supabase no singleton, que produce bucles infinitos de suscripción Realtime y de red tanto en la sala como en el admin.
- **La documentación (`AGENTS.md`) sobrestima el estado real en al menos 15 puntos** y debe re-sincronizarse tras cada fase del plan.
- **Plan recomendado:** 8 fases (~10-14 días) en el orden Fase 0 → Fase 7, cerrando cada una con lint + typecheck + prueba manual.
