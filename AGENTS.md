<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# MAESTROSYNC (MUSIC-FLOW) — AGENTS.md

> Guía de contexto integral para agentes de IA que trabajan en este repositorio.
> Este archivo es la **fuente de verdad** para convenciones, arquitectura, patrones de sincronización musical y reglas de desarrollo del proyecto.
> **NO modifica lógica de la aplicación por sí solo; debe respetarse estrictamente en cada cambio.**

---

## ⚠️ REGLAS CRÍTICAS (LEER ANTES DE TOCAR CUALQUIER ARCHIVO)

1. **Monorepo Turborepo con pnpm** — Este proyecto está estructurado con pnpm workspaces (`apps/web`, `apps/admin`, `packages/*`). Nunca agregues dependencias cruzadas ad-hoc; usa siempre la convención de paquetes internos `"workspace:*"` (ej. `@music-flow/ui`, `@music-flow/supabase`, `@music-flow/stores`).
2. **Next.js 16.3 + React 19** — Ambos apps (`web` y `admin`) utilizan App Router en Next.js 16.3.8 y React 19.3.0. Evita patrones obsoletos de Pages Router o Server Components desactualizados. Respeta `React.use()` para unwrapping de `params` y `searchParams` asíncronos.
3. **Sincronización milimétrica Realtime sin drift** — En MaestroSync, la música y el avance visual de las partituras no toleran lag acumulativo. La sincronización Director ↔ Ejecutantes se basa en Supabase Realtime (Broadcast + Presence) y cálculo de offset temporal (`playback_started_at` + `tempo_bpm` + `requestAnimationFrame`), **no en eventos discretos por compás**.
4. **Resaltado por pentagrama (`HighlightOverlay`), no por página** — Cada ejecutante ve la partitura completa (o su arreglo) pero el highlight resalta **exclusivamente el pentagrama del instrumento que seleccionó**. Las coordenadas son relativas normalizadas (`bbox_x`, `bbox_y`, `bbox_w`, `bbox_h`).
5. **MVP sin OMR automatizado** — El marcado de pentagramas y compases en esta fase es **manual** (`is_manually_corrected = true`), realizado por el usuario en el editor de carga (`/upload`). No crear microservicios pesados de OMR hasta que la fase 2 lo requiera expresamente.
6. **RLS (Row Level Security) 100% activo** — Todas las tablas tienen RLS habilitado. Las partituras y archivos son estrictamente privados por usuario (`owner_id = auth.uid()`). El cliente `createServiceRoleClient()` se reserva exclusivamente para Webhooks de Stripe y operaciones administrativas del backend.
7. **Diseño para atriles ("Stand-Ready")** — El lenguaje visual prioritario es **Alto Contraste / Dark Mode profundo** (`#0b0f17`, `#0f172a`, acentos ámbar `#f59e0b`), pensado para tablets en atriles musicales bajo condiciones de baja iluminación escénica. Deshabilitar zoom accidental táctil (`userScalable: false`).
8. **Internacionalización con `next-intl`** — `apps/web` opera bajo rutas localizadas `/[locale]/...`. Los idiomas prioritarios son **Español (`es`)** e **Inglés (`en`)**. Textos de UI no deben hardcodearse; usar los diccionarios en `@music-flow/i18n`.
9. **Todas las validaciones de los atributos <input /> deben ser mostradas al usuario con CSS moderno de acuerdo a la aplicación y no con las validaciones nativas de HTML.** 
---

## 🗂️ STACK TECNOLÓGICO

| Capa / Módulo | Tecnología | Versión | Uso y Notas |
|---|---|---|---|
| **Monorepo Engine** | Turborepo | `^2.11.7` | Orquestación de builds y pipelines |
| **Package Manager** | pnpm | `11.21.0` | Gestión estricta de workspaces |
| **Framework Web & Admin** | Next.js | `^16.3.8` | App Router con Turbopack |
| **UI Library** | React | `^19.3.0` | React Server Components & Actions |
| **Lenguaje** | TypeScript | `^5.8.0` | Tipado estricto compartido en monorepo |
| **Estilos** | Tailwind CSS | `^4.3.3` | `@tailwindcss/postcss` con theme tokens en `globals.css` |
| **Iconografía** | Lucide React | `^1.52.0` | Iconos musicales, controles de playback y navegación |
| **Animaciones de Highlight** | Framer Motion | `^14.0.0` | Transición suave de bounding boxes y modales |
| **Estado Global de Cliente** | Zustand | `^5.0.15` | Stores atómicos en `packages/stores` |
| **Backend & Base de Datos** | Supabase | PostgreSQL 15+ | Auth, Postgres DB, Storage buckets, Realtime |
| **SDK Supabase** | `@supabase/supabase-js` | `^2.49+` | Cliente browser y cliente server con tipado `Database` |
| **Procesador de Partituras** | `pdfjs-dist` | `^3.11.174` | Renderizado de páginas PDF a imágenes de alta fidelidad |
| **i18n** | `next-intl` | `^4.14.9` | Rutas `/[locale]/...`, diccionarios JSON tipados |
| **PWA** | `@ducanh2912/next-pwa` | `^10.2.9` | Modo standalone, cache offline de partituras ya descargadas |
| **Pagos y Planes** | Stripe Node SDK | `^23.0.0` | Checkout, Customer Portal, Webhooks (`packages/stripe`) |
| **Métricas Admin** | Recharts | `^3.10.1` | Gráficas analíticas en tiempo real en `apps/admin` |

---

## 📁 ESTRUCTURA DEL PROYECTO (TURBOREPO MONOREPO)

```
music-flow/
├── apps/
│   ├── web/                          # App principal (Next.js - Puerto 3002) — Director & Ejecutantes
│   │   ├── app/
│   │   │   ├── [locale]/             # Rutas con internacionalización
│   │   │   │   ├── layout.tsx        # Layout con NextIntlClientProvider + PWAUpdateNotification
│   │   │   │   ├── page.tsx          # Home / Landing interactiva
│   │   │   │   ├── library/          # Biblioteca de obras y partituras del usuario
│   │   │   │   │   └── page.tsx      # Filtros por autor, tonalidad, compás y catálogo
│   │   │   │   ├── login/            # Autenticación (Email, Google, Apple, Passkeys)
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── session/          # Sala de ejecución sincronizada
│   │   │   │   │   └── [code]/       # Sesión activa por código de sala (MZ7K-2Q)
│   │   │   │   │       └── page.tsx  # Canvas partitura + HighlightOverlay + Realtime
│   │   │   │   └── upload/           # Carga de PDF/imágenes y marcado de sistemas
│   │   │   │       └── page.tsx      # Paso 1: Metadatos | Paso 2: Editor visual de pentagramas
│   │   │   ├── api/
│   │   │   │   └── webhooks/
│   │   │   │       └── stripe/       # Webhooks de suscripciones (actualiza public.subscriptions)
│   │   │   ├── components/
│   │   │   │   └── PWAUpdateNotification.tsx # Banner de nueva versión PWA
│   │   │   └── globals.css           # Tokens Tailwind v4, tema Stand-Ready oscuro y scrollbars
│   │   ├── i18n/                     # Configuración de request y locales soportados
│   │   ├── public/                   # Manifest.json, iconos PWA, assets estáticos
│   │   ├── next.config.js            # Plugin PWA con @ducanh2912/next-pwa
│   │   └── package.json              # Dependencias de web (port 3002)
│   │
│   └── admin/                        # Panel de administración de plataforma (Puerto 3001)
│       ├── app/
│       │   ├── layout.tsx            # Layout con Dark theme fijo
│       │   ├── page.tsx              # Dashboard: Overview, Usuarios, Suscripciones, Moderación
│       │   └── globals.css           # Estilos para dashboard administrativo
│       └── package.json              # Dependencias de admin (port 3001)
│
├── packages/
│   ├── ui/                           # Componentes de diseño compartidos
│   │   ├── HighlightOverlay.tsx      # Bounding box reactivo con Framer Motion y badge
│   │   ├── Button.tsx                # Variantes primary, secondary, destructive, outline
│   │   ├── Card.tsx                  # Card, CardHeader, CardTitle, CardDescription
│   │   ├── utils.ts                  # Helper clsx/twMerge (cn)
│   │   └── index.ts                  # Barrel export
│   │
│   ├── supabase/                     # Conector y cliente tipado
│   │   ├── client.ts                 # createBrowserClient() con tipos Database
│   │   ├── server.ts                 # createServiceRoleClient() para backend y webhooks
│   │   ├── types.ts                  # Definiciones TypeScript de todas las tablas de Supabase
│   │   └── index.ts                  # Barrel export
│   │
│   ├── stores/                       # Manejadores de estado cliente (Zustand)
│   │   ├── usePlaybackStore.ts       # Estado de reproducción: status, tempo, compás actual, timestamp
│   │   ├── useSessionStore.ts        # Datos de sala: roomCode, rol (director/performer), participantes
│   │   ├── useLibraryStore.ts        # Partituras, filtros y obra seleccionada
│   │   ├── useUploadStore.ts         # Progreso de subida y marcado de pentagramas
│   │   ├── useAuthStore.ts           # Perfil actual, instrumento favorito, idioma
│   │   └── index.ts                  # Barrel export
│   │
│   ├── i18n/                         # Internacionalización compartida
│   │   ├── messages/
│   │   │   ├── es.json               # Diccionario en Español
│   │   │   └── en.json               # Diccionario en Inglés
│   │   └── index.ts                  # Barrel export y exportación de mensajes
│   │
│   ├── stripe/                       # Lógica de facturación
│   │   ├── index.ts                  # PLANS_CONFIG (Free, Individual, Org) y helper de cliente Stripe
│   │   └── package.json
│   │
│   └── config/                       # Configuraciones base de TypeScript y ESLint
│       ├── tsconfig.base.json
│       └── package.json
│
├── supabase/
│   └── schema.sql                    # Definición DDL completa de PostgreSQL + RLS + Triggers
│
├── md-files/                         # Documentación de diseño y producto
│   ├── arquitectura-tecnica_1.md     # Especificación técnica del MVP
│   ├── plan-funcional-music-sync.md  # Plan funcional maestro
│   └── panel-administracion.md       # Requisitos del dashboard de administración
│
├── turbo.json                        # Configuración de pipeline de Turborepo
├── package.json                      # Workspaces de monorepo raíz
├── pnpm-workspace.yaml               # Definición de packages y apps
└── TODO.txt                          # Lista de tareas y próximos hitos del proyecto
```

---

## 🔐 AUTENTICACIÓN, ROLES Y MODELO DE SESIÓN

### 1. Roles del Sistema

| Ámbito | Rol | Descripción | Permisos Clave |
|---|---|---|---|
| **Sesión (Efímera)** | `director` | Creador de la sala o usuario transferido | Control total de Play/Pause/Stop, Seek por compás, Tempo BPM en vivo. |
| **Sesión (Efímera)** | `performer` | Músicos o ejecutantes conectados | Selección de instrumento propio, lectura sincronizada con auto-scroll. |
| **Plataforma (Global)**| `is_platform_admin` | Booleano en `public.profiles` | Acceso a `apps/admin` (moderación de usuarios, partituras y métricas). |

### 2. Flujo de Sesión Musical en Tiempo Real
1. **Creación**: Un usuario inicia una sesión sobre una versión de partitura (`work_version_id`). La app crea un registro en `sessions` y genera un `room_code` único (ej. `MZ7K-2Q`). El creador asume el rol `director`.
2. **Conexión de Ejecutantes**: Los músicos introducen el código `MZ7K-2Q` en `/session/[code]`, ingresan como `performer` y seleccionan su atril/instrumento (ej. "Violín I", "Viola", "Clarinete").
3. **Reconexión transparente**: La tabla `sessions` guarda en DB el estado (`status`, `tempo_bpm`, `current_measure`, `playback_started_at`). Si un ejecutante pierde conexión Wi-Fi momentáneamente, la app lee el registro al reconectar y calcula el compás actual sin interrumpir al resto de la orquesta.
4. **Transferencia de Director**: Si el director se desconecta o cede el control, se ejecuta la función RPC `transfer_director(session_id, new_director_id)` con validación atómica `security definer`.

### 3. Métodos de Autenticación
- **Supabase Auth**: Soporta inicio de sesión mediante Email/Password, Google OAuth y Apple ID.
- **Passkeys / WebAuthn**: Para atriles y tablets en vivo, el usuario puede vincular Face ID / Touch ID / Windows Hello vía `navigator.credentials.get` para inicio de sesión en un solo toque antes de salir a escena.

---

## ⚡ REALTIME — ARQUITECTURA DE SINCRONIZACIÓN MILIMÉTRICA

### 1. Principio Fundamental
> **No existe polling en la sala de ensayo.** El director emite órdenes de playback instantáneas a través de Supabase Realtime Broadcast, y la presencia de la orquesta se monitorea mediante Supabase Presence.

### 2. Canales Activos

| Canal | Tipo | Propósito |
|---|---|---|
| `session:{room_code}` | `broadcast` (`playback_sync`) | Control de Play, Pause, Stop, Seek y cambio de Tempo en vivo. |
| `session:{room_code}` | `presence` (`sync`) | Monitoreo de músicos en sala: rol, instrumento activo y timestamp de unión. |
| `admin:notifications` | `postgres_changes` | Notificaciones en tiempo real para nuevos usuarios y suscripciones en el admin. |

### 3. Modelo de Eventos de Playback (`playback_sync`)

```typescript
type PlaybackBroadcastPayload = {
  status: 'waiting' | 'playing' | 'paused' | 'stopped' | 'ended'
  tempoBpm: number
  currentMeasure: number
  playbackStartedAt: string | null // ISO timestamp del servidor/director
  serverTime: string               // Timestamp para calcular y compensar latencia
}
```

### 4. Eliminación de Drift mediante `requestAnimationFrame`
Para garantizar que 50 tablets avancen el compás exactamente al unísono sin depender de recibir 50 mensajes de red por minuto:
1. El director envía el evento `play` con `playbackStartedAt = now()`.
2. Cada cliente calcula en su propio ciclo de render:
   ```typescript
   const elapsedSeconds = (timestamp - startTime) / 1000
   const secondsPerMeasure = (timeSignatureBeats * 60) / tempoBpm
   const measuresAdvanced = Math.floor(elapsedSeconds / secondsPerMeasure)
   const currentMeasure = initialMeasure + measuresAdvanced
   ```
3. El store local determina qué `score_system` coincide con `currentMeasure >= sys.measureStart && currentMeasure < sys.measureStart + sys.measureCount`.
4. Si el director cambia el tempo en vivo (`setTempo`), se ajusta la referencia de tiempo restante a partir del compás actual sin reiniciar la obra.

### 5. Patrón Obligatorio de Suscripción en Client Components

```typescript
'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@music-flow/supabase'

export function useSessionRealtime(roomCode: string, onSync: (payload: any) => void) {
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase.channel(`session:${roomCode}`)

    channel
      .on('broadcast', { event: 'playback_sync' }, ({ payload }) => {
        onSync(payload)
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState()
        // actualizar participantes conectados
      })
      .subscribe()

    // OBLIGATORIO: Cleanup en el retorno para no fugar canales ni generar listeners zombies
    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, supabase])
}
```

---

## 🎼 GESTIÓN Y SINCRONIZACIÓN DE PARTITURAS

### 1. Jerarquía de Obras en Base de Datos

```
public.works (Obra matriz: título, compositor, catálogo BWV/K/Op, tonalidad, compás base)
  └── public.work_versions (Versión: arreglo cuarteto, reducción de piano, orquesta completa)
        └── public.scores (Archivo binario PDF o PNG/JPG subido a Supabase Storage)
              └── public.score_pages (Render de cada página en alta resolución)
                    └── public.score_systems (Pentagramas / renglones con bounding box y compases)
```

### 2. Coordenadas Normalizadas para el Highlight
Para que el highlight escale fielmente en un iPad Pro, un Galaxy Tab, una pantalla 16:9 o un smartphone:
- Las coordenadas `bbox_x`, `bbox_y`, `bbox_w`, `bbox_h` en `score_systems` se almacenan en valores **normalizados de 0.0 a 1.0**.
- `<HighlightOverlay />` utiliza porcentajes (`left: ${bboxX * 100}%`, `top: ${bboxY * 100}%`) garantizando alineación visual perfecta sobre cualquier contenedor de partitura responsivo.

### 3. Auto-Scroll de Partitura
Cuando el pentagrama activo se ubica fuera del viewport de lectura:
- El componente debe ejecutar un scroll suave automático (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) hacia el sistema activo, permitiendo que el músico mantenga las manos en el instrumento en todo momento.

---

## 🎨 UI/UX — SISTEMA DE DISEÑO "STAND-READY" (ESCENARIO Y ATRIL)

### 1. Filosofía Visual
- **Alto contraste oscuro**: Fondo ultra-oscuro `#0b0f17` con superficies `#0f172a` para no emitir luz cegadora en atriles de auditorios u orquestas.
- **Color de acento ámbar/dorado**:
  - `brand-500: #f59e0b` (ámbar intenso)
  - `brand-600: #d97706`
  - Borde del highlight: `border-amber-400 bg-amber-400/20 shadow-amber-400/25`
- **Tipografía legible**: Controles grandes y botones con target táctil mínimo de 48px para pulsaciones rápidas con dedos o stylus en atril.
- **Scrollbars de alto contraste**:
  ```css
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #0f172a; }
  ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #f59e0b; }
  ```

### 2. Componentes Compartidos (`packages/ui`)
- `<HighlightOverlay />`: Marco de enfoque sobre el pentagrama con animación spring de Framer Motion y badge flotante con el nombre del instrumento.
- `<Button />`: Botones con variantes `primary` (ámbar), `secondary` (slate), `destructive` (rojo) y `outline`.
- `<Card />`, `<CardHeader />`, `<CardTitle />`, `<CardDescription />`: Paneles con bordes sutiles slate-700 y fondos pizarra.

### 3. PWA y Prevención de Interrupciones en Vivo
- Configurada con `@ducanh2912/next-pwa`.
- Deshabilitar pinch-to-zoom accidental en atril: `userScalable: false` en viewport metadata de Next.js.
- Alertas de actualización amigables mediante `<PWAUpdateNotification />`.

---

## 🗄️ BASE DE DATOS Y ROW LEVEL SECURITY (RLS)

El archivo `supabase/schema.sql` define el esquema oficial:

### 1. Tablas y Dominios Principales

| Dominio | Tablas | RLS y Reglas de Negocio |
|---|---|---|
| **Usuarios & Instrumentos** | `profiles`, `instruments` | Cada usuario edita su propio perfil. `is_platform_admin` permite ver todos en `apps/admin`. |
| **Catálogo de Partituras** | `works`, `work_versions`, `scores`, `score_pages`, `score_systems`, `omr_jobs` | Estrictamente privado: `owner_id = auth.uid()`. Cascade delete en sub-tablas. |
| **Sesiones en Vivo** | `sessions`, `session_participants` | Director tiene acceso total. Participantes activos de la sala pueden consultar el estado (`select`). |
| **Organizaciones & Equipos** | `organizations`, `organization_members` | El creador de la organización administra los asientos; los miembros pueden ver su membresía. |
| **Planes & Suscripciones** | `plans`, `subscriptions` | Lectura para el propietario del plan/organización. Modificación restringida al webhook backend de Stripe. |
| **Panel de Administración** | `admin_notifications`, `moderation_actions` | Restringido exclusivamente para `is_platform_admin()`. |

### 2. Reglas Estrictas de Seguridad
- **Nunca omitir RLS**: Al crear nuevas tablas, siempre incluir `alter table public.nueva_tabla enable row level security;` y sus políticas correspondientes.
- **Service Role**: Utilizar `createServiceRoleClient()` **únicamente** en Server Actions de administración interna o endpoints de Webhooks (`apps/web/app/api/webhooks/stripe/route.ts`). Jamás exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente web.

---

## 💳 MONETIZACIÓN Y PLANES (STRIPE)

Definido en `packages/stripe/index.ts`:

```typescript
export const PLANS_CONFIG = {
  FREE: {
    code: 'free',
    name: 'Plan Gratuito',
    maxScores: 2, // Límite de 2 partituras almacenadas
  },
  INDIVIDUAL_MONTHLY: {
    code: 'individual_monthly',
    name: 'Plan Individual Mensual',
    maxScores: Infinity,
  },
  ORG_ANNUAL: {
    code: 'org_annual',
    name: 'Plan Orquesta / Organización',
    maxScores: Infinity,
  },
} as const
```

- En el plan gratuito, validar el límite de partituras antes de permitir la subida en `/upload`.
- La sincronización y gestión de cuotas de usuario se maneja vía Webhooks de Stripe actualizando la tabla `public.subscriptions`.

---

## 🚀 COMANDOS DE DESARROLLO

```bash
# 1. Instalar dependencias en todo el monorepo
pnpm install

# 2. Iniciar ambos proyectos en simultáneo vía Turborepo
pnpm dev

# 3. Iniciar únicamente la app Web (Director / Músicos) — corre en puerto 3002
pnpm dev:web

# 4. Iniciar únicamente el panel Admin — corre en puerto 3001
pnpm dev:admin

# 5. Build de producción de todos los paquetes y apps
pnpm build

# 6. Ejecutar linter en todo el monorepo
pnpm lint
```

- **App Web**: `http://localhost:3002`
- **Panel Admin**: `http://localhost:3001`

---

## 📋 ESTADO ACTUAL DEL PROYECTO

### ✅ Implementado y Verificado
- Monorepo Turborepo configurado con pnpm workspaces (`apps/web`, `apps/admin`, `packages/*`).
- Esquema DDL de base de datos completo en `supabase/schema.sql` con tablas, índices, triggers `updated_at` y RLS exhaustivo.
- Capa de Supabase tipada en `packages/supabase` (`client.ts`, `server.ts`, `types.ts`).
- Stores de estado con Zustand en `packages/stores` (`usePlaybackStore`, `useSessionStore`, `useAuthStore`, `useLibraryStore`, `useUploadStore`).
- Componente de resaltado musical fluido `<HighlightOverlay />` con Framer Motion en `packages/ui`.
- Vista de sesión interactiva `/session/[code]` con canal de Realtime Broadcast + Presence, selector de instrumento y loop de `requestAnimationFrame`.
- Vista de carga `/upload` con formulario de metadatos y prototipo de marcado manual de bounding boxes de sistemas.
- Vista de biblioteca `/library` con búsqueda y filtros por compositor, tonalidad y referencia de catálogo.
- Configuración de PWA en `apps/web` con Service Worker y banner de actualización.
- Panel administrativo en `apps/admin` con métricas, tabs de usuarios, moderación y gráfica Recharts.
- Estructura de paquetes para internacionalización (`@music-flow/i18n`) y facturación (`@music-flow/stripe`).

### 🔄 En Desarrollo / Próximos Pasos (según `TODO.txt`)
1. **Configuración de variables de entorno `.env`**: Vincular URL y llaves reales de Supabase y Stripe.
2. **Procesamiento de PDF a imágenes**: Integrar `pdfjs-dist` en el flujo de `/upload` para renderizar cada página del PDF en `score_pages` y subirlas a Supabase Storage.
3. **Editor visual de marcado manual**: Perfeccionar el editor táctil donde el usuario dibuja rectángulos sobre la página de la partitura para registrar `bbox_x, bbox_y, bbox_w, bbox_h` y compases en `score_systems`.
4. **Endpoints de Stripe Checkout y Webhook**: Completar la ruta de checkout y el handler de webhook en `apps/web/app/api/webhooks/stripe`.
5. **Microservicio OMR (Fase 2 / Futuro)**: Integración de Audiveris u oemer en contenedor dedicado para detección automática opcional de pentagramas.

---

## 📝 REGLAS FINALES PARA AGENTES

### Antes de Crear o Editar Código
1. **Verifica siempre la raíz del workspace**: Si modificas componentes visuales genéricos, agrégalos a `packages/ui`. Si modificas estado compartido, agrégalo a `packages/stores`.
2. **Nunca rompas la compatibilidad del monorepo**: No agregues importaciones relativas entre apps (ej. no importar archivos de `apps/admin` dentro de `apps/web`). Todo lo compartido vive en `packages/`.
3. **Preserva la convención de puertos**: `apps/web` opera en el puerto `3002` y `apps/admin` en el puerto `3001`.
4. **Respeta la eliminación en cascada de partituras**: Al borrar una obra o versión, asegurarse de limpiar los archivos correspondientes en Supabase Storage.
5. **No hardcodear textos**: Usar `@music-flow/i18n` o mantener mensajes consistentes con el diccionario de la aplicación.
6. **Manejo de errores y desconexiones**: Cualquier llamada a Supabase Realtime debe contar con un fallback y cleanup en el hook de React (`supabase.removeChannel`).

### Lo que NUNCA debes hacer
- ❌ Usar `"use client"` innecesariamente en páginas o componentes puramente informativos.
- ❌ Importar `createServiceRoleClient()` dentro de Client Components o código expuesto al navegador.
- ❌ Emitir eventos Realtime continuos por cada frame de reproducción (usa `requestAnimationFrame` en el cliente a partir del timestamp inicial).
- ❌ Usar coordenadas absolutas en pixeles para el resaltado de partituras (siempre usar bounding boxes normalizados `0.0 - 1.0`).
- ❌ Romper el modo oscuro de alto contraste diseñado para escenarios y atriles musicales.
- ❌ Borrar registros con `DELETE` manual sin contemplar la integridad referencial definida en `supabase/schema.sql`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
