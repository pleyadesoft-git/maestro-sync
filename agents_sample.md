<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# SM RESTAURANT PRO — AGENTS.md

> Guía de contexto completa para agentes de IA trabajando en este repositorio.
> Este archivo es la **fuente de verdad** para convenciones, arquitectura, patrones y reglas del proyecto.
> **NO modifica ninguna lógica de la aplicación.**

---

## ⚠️ REGLAS CRÍTICAS (LEER ANTES DE TOCAR CUALQUIER ARCHIVO)

1. **Next.js 16.2 tiene breaking changes** — Lee `node_modules/next/dist/docs/` antes de escribir cualquier código de routing, rendering o Server Actions. Las convenciones del App Router pueden diferir de tu training data.
2. **Todo el UI está en español** — Labels, mensajes de error, placeholders, toasts, confirmaciones, comentarios en código orientados al usuario: **100% en español**. Los comentarios técnicos pueden ser en inglés.
3. **Nunca uses `"use client"` innecesariamente** — Favorece Server Components. Solo añade `"use client"` cuando sea estrictamente necesario (interactividad, hooks de estado, Realtime subscriptions, `framer-motion`).
4. **RLS siempre activo** — Nunca hagas queries sin pasar por el cliente de Supabase con la sesión del usuario. El `serviceRole` (admin client) solo se usa en Server Actions que requieren bypass de RLS.
5. **No rompas el diseño glassmorphism** — El lenguaje visual del Sign-In es la referencia de **toda** la app. Ver sección UI/UX.
6. **100% Realtime** — Todas las operaciones críticas (órdenes, mesas, estado de usuarios, KDS, chat, notificaciones) operan en tiempo real. No existe polling tradicional; todo fluye por Supabase Realtime.
7. **Eliminación siempre lógica** — Jamás usar `DELETE FROM` en tablas de negocio. Siempre `deleted_at` + `deleted_by`.
8. **No hardcodees IDs** — Nunca hardcodear IDs de sucursal, usuario o cualquier entidad. Siempre obtener el contexto del perfil autenticado.

---

## 🗂️ STACK TECNOLÓGICO

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.2.2 | Framework principal (App Router) |
| React | 19.2.4 | UI library |
| TypeScript | ^5 | Tipado estático |
| TailwindCSS | ^4.2.2 | Estilos utilitarios (`@utility`, `@theme inline`, `@custom-variant`) |
| ShadCN UI | ^4.1.2 | Componentes base (customizados con glassmorphism) |
| Framer Motion | ^12.38.0 | Animaciones de entrada/salida/transición |
| Lucide React | ^1.7.0 | Iconos SVG |
| Supabase JS | ^2.101.1 | Auth + Realtime + DB (PostgreSQL) |
| Supabase SSR | ^0.10.0 | Cookies y sesión server-side |
| Sonner | ^2.0.7 | Toast notifications |
| Radix UI | ^1.4.3 | Primitivos accesibles (Dialog, DropdownMenu, Select, etc.) |
| date-fns | ^4.1.0 | Manipulación de fechas |
| nodemailer | ^6.9.13 | Envío de emails server-side |

---

## 📁 ESTRUCTURA DEL PROYECTO

```
/app
  /admin                → Dashboard SUPER_ADMIN / ADMIN
    /categorias         → CRUD Categorías de productos
    /horarios           → Gestión de horarios
    /menu               → Gestión de menú digital
    /mesas              → CRUD Mesas y Zonas
    /productos          → CRUD Platillos
    /sucursales         → CRUD Sucursales
    /usuarios           → CRUD Usuarios con Realtime
  /api                  → API Routes
  /auth                 → Callbacks y acciones de autenticación
    /callback           → OAuth callback handler
    /reset-password     → Flujo de reset de contraseña
    /update-password    → Actualización de contraseña
    actions.ts          → Server Actions de auth (login, signup, signOut, OAuth)
    user-actions.ts     → Acciones de perfil de usuario
  /components           → Componentes a nivel de app (layouts, providers, modales)
    /layouts
      dashboard-layout.tsx → Layout maestro con sidebar/header glassmorphism
    /providers
      branch-context.tsx   → Context + Provider para sucursal activa
      client-providers.tsx → Wrapper raíz (BranchProvider + UserStatusGuard)
      user-status-guard.tsx → Guard Realtime que expulsa usuarios inactivados
    confirm-dialog.tsx     → Diálogo de confirmación reutilizable (glassmorphism)
    home-auth-handler.tsx  → Handler de redirección por rol con Realtime
    pin-pad-modal.tsx      → Modal de PIN para POS
    table-input-modal.tsx  → Modal de selección de mesa
  /compras              → Módulo de órdenes de compra
  /configuracion        → Ajustes generales, roles e integraciones
  /cuentas-pagar        → Panel de cuentas por pagar
  /forgot-password      → Recuperación de contraseña
  /inventario           → Almacenes, insumos, existencias y movimientos
  /kds                  → Kitchen Display System (Realtime)
  /login                → Página de login (glassmorphism + imagen de fondo)
  /menu                 → Carta digital pública (ruta pública, sin auth)
  /mesero               → Dashboard Mesero (mesas, órdenes, comandas Realtime)
  /mi-cuenta            → Perfil del usuario logueado
  /oficina              → Dashboard Admin Oficina
  /pending              → Pantalla de espera para usuarios sin rol
  /pos                  → Punto de Venta (apertura de caja, cobro)
  /proveedores          → CRUD Proveedores
  /recepcion            → Dashboard Recepcionista (reservaciones, lista de espera)
  /recetas              → Recetas e ingredientes con costeo
  /signup               → Registro de nuevos usuarios
  /super-admin          → Dashboard del Super Administrador (métricas globales)
  globals.css           → Estilos globales + variables CSS + utilidades glassmorphism
  layout.tsx            → Root layout (Inter font, Toaster, ClientProviders)
  not-found.tsx         → Página 404 personalizada en español
  page.tsx              → Página raíz (HomeAuthHandler)

/components             → Componentes reutilizables globales
  /chat                 → Sistema de chat interno Realtime
    chat-actions.ts     → Server Actions del chat
    chat-floating-button.tsx → Botón flotante de chat
    chat-message-item.tsx    → Componente de mensaje individual
    chat-panel.tsx           → Panel lateral de chat
  /realtime
    NotificationListener.tsx → Listener global de notificaciones Realtime
  /ui                   → Componentes ShadCN customizados
  change-password-modal.tsx → Modal cambio de contraseña
  glass-button.tsx      → Botón glassmorphism (primary/secondary/danger/ghost)
  glass-card.tsx        → Card glassmorphism con variantes de color
  glass-input.tsx       → Input glassmorphism estilo iOS
  realtime-banner.tsx   → Banner de notificaciones Realtime
  status-badge.tsx      → Badge semántico por estado (active/inactive/pending/etc.)

/hooks                  → Custom hooks
  use-chat.ts           → Hook del sistema de chat
  use-check-role.ts     → Hook de verificación de rol del usuario

/lib                    → Tipos, utilidades y helpers
  types.ts              → Todas las interfaces y tipos TypeScript del dominio
  utils.ts              → Función `cn()` para class merging (clsx + tailwind-merge)

/utils                  → Utilidades de infraestructura
  /supabase
    admin.ts            → Cliente Supabase con serviceRole (solo server-side)
    client.ts           → Cliente Supabase browser (con shims para HTTP/non-secure)
    server.ts           → Cliente Supabase server (cookies, Server Components)
  origin.ts             → Helper para obtener la URL de origen
  smtp.ts               → Configuración de SMTP para emails

/plan
  plan.md               → Plan de desarrollo completo v2.0 (roadmap por fases)

/middleware.ts          → Protección de rutas, redirección por rol, validación de sesión
```

---

## 🔐 AUTENTICACIÓN Y ROLES

### Roles del sistema

```typescript
type UserRole =
  | 'SUPER_ADMIN'     // → /super-admin (acceso global a TODAS las rutas)
  | 'ADMIN'           // → /admin (acceso a casi todas las rutas de su sucursal)
  | 'WAITER'          // → /mesero
  | 'WAITER_CAPTAIN'  // → /mesero
  | 'CASHIER'         // → /pos
  | 'KITCHEN'         // → /kds
  | 'CHEF'            // → /kds
  | 'RECEPCIONIST'    // → /recepcion
  | 'ADMIN_OFFICE'    // → /oficina (+ inventario, recetas, proveedores, compras, cuentas-pagar)
```

### Estados de usuario

```typescript
type UserStatus = 'pending' | 'active' | 'inactive'
type OnlineStatus = 'available' | 'inactive'
```

- `pending` → Usuario registrado sin rol asignado → ve `/pending` (pantalla de espera con Realtime)
- `active` → Con rol asignado, puede operar en su dashboard correspondiente
- `inactive` → Bloqueado. **Realtime cierra su sesión automáticamente** vía `UserStatusGuard`

### Mapa de rutas permitidas por rol (middleware.ts)

```typescript
const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  SUPER_ADMIN: ['/admin', '/super-admin', '/configuracion', '/kds', '/pos', '/recepcion',
                '/oficina', '/inventario', '/recetas', '/proveedores', '/compras',
                '/cuentas-pagar', '/mesero', '/menu'],
  ADMIN:       ['/admin', '/configuracion', '/mesero', '/kds', '/pos', '/oficina',
                '/inventario', '/recetas', '/proveedores', '/compras', '/cuentas-pagar',
                '/recepcion', '/menu'],
  WAITER:         ['/mesero'],
  WAITER_CAPTAIN: ['/mesero'],
  CASHIER:        ['/pos'],
  KITCHEN:        ['/kds'],
  RECEPCIONIST:   ['/recepcion'],
  ADMIN_OFFICE:   ['/oficina', '/admin', '/inventario', '/recetas', '/proveedores',
                   '/compras', '/cuentas-pagar'],
}
```

### Rutas públicas (sin sesión requerida)

```
/login, /signup, /forgot-password, /auth/*, /menu/*, /pending, /auth/reset-password
```

### Reglas de negocio críticas

- `SUPER_ADMIN` solo se crea directo en la base de datos, **nunca desde la UI**
- Solo `SUPER_ADMIN` y `ADMIN` pueden gestionar usuarios
- Un usuario pertenece a **una sola sucursal** a la vez (excepto roles globales: SUPER_ADMIN, ADMIN, ADMIN_OFFICE)
- Roles globales (`SUPER_ADMIN`, `ADMIN`, `ADMIN_OFFICE`) **no requieren `branch_id`** para estar activos
- Si un usuario es inactivado con sesión activa → `UserStatusGuard` en Realtime cierra su sesión y redirige a `/pending`
- La sesión se cierra con `scope: 'global'` (todas las pestañas/dispositivos)
- Google OAuth usa `prompt: 'select_account'` para forzar selector de cuentas

---

## 🏗️ CONVENCIONES DE CÓDIGO

### Clientes Supabase — 3 variantes, sin excepción

```typescript
// ✅ Client Components (browser) — hooks, Realtime, interactividad
import { createClient } from '@/utils/supabase/client'

// ✅ Server Components, Server Actions, Route Handlers
import { createClient } from '@/utils/supabase/server'

// ✅ Operaciones administrativas server-side (bypass RLS, confirmar usuarios)
import { createAdminClient } from '@/utils/supabase/admin'
// También existe: import { createAdminClient } from '@/app/auth/actions' (inline)

// ❌ NUNCA importar serviceRole en el frontend/client-side
```

> **Nota:** El cliente browser (`utils/supabase/client.ts`) incluye shims para `crypto.subtle` y `crypto.randomUUID` para entornos HTTP no seguros (desarrollo en LAN). No eliminar estos shims.

### Server Actions — Patrón estándar

```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function miAction(data: any) {
  const supabase = await createClient()

  // 1. Validar sesión SIEMPRE
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  // 2. Ejecutar operación
  const { data: result, error } = await supabase
    .from('tabla')
    .insert([{ ... }])
    .select()
    .single()

  if (error) throw new Error(error.message)

  // 3. Revalidar todas las rutas afectadas
  revalidatePath('/ruta-principal')
  revalidatePath('/rutas-relacionadas')
  return result
}
```

### Eliminación — SIEMPRE lógica

```typescript
// ✅ Correcto
export async function deleteEntity(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('tabla')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id,
      status: 'inactive'  // si la tabla tiene campo status
    })
    .eq('id', id)
}

// ❌ NUNCA
await supabase.from('tabla').delete().eq('id', id)
```

### Queries — SIEMPRE filtrar registros eliminados

```typescript
// ✅ Correcto
const { data } = await supabase
  .from('tabla')
  .select('*')
  .is('deleted_at', null)  // Filtro obligatorio
  .order('name', { ascending: true })

// ❌ Nunca sin filtro de deleted_at
```

### Tipos TypeScript

- Definir todos los tipos en `/lib/types.ts`
- Usar las interfaces del proyecto como base (ver `Profile`, `Branch`, `Order`, `Product`, etc.)
- **No usar `any`** — usar `unknown` y hacer narrow. Excepción: payloads de Realtime donde se castea explícitamente
- Orden de imports:
  ```typescript
  // 1. React / Next.js
  // 2. Librerías externas (framer-motion, lucide-react, sonner)
  // 3. Imports internos con alias @/
  // 4. Tipos
  ```

---

## 🎨 UI/UX — SISTEMA DE DISEÑO GLASSMORPHISM (iOS-INSPIRED)

**Referencia visual:** La página de Login/Sign-In es el estándar visual para **todas** las vistas del sistema.

### Filosofía de diseño

- **Glassmorphism moderno** con backdrop-blur, transparencias y bordes luminosos
- **Soporte completo Light + Dark mode** — cada utilidad CSS tiene su variante `.dark`
- **Animaciones Framer Motion** en cada entrada de elementos
- **Fondo animado** con gradientes radiales que se mueven suavemente (`.dashboard-bg`)
- **Scrollbars modernos** con gradientes indigo/púrpura (`.scroll-modern`)

### Componentes Glass del sistema (NO crear duplicados)

| Componente | Ubicación | Uso |
|---|---|---|
| `<GlassCard />` | `components/glass-card.tsx` | Contenedor glassmorphism. Variantes: `default`, `purple`, `blue`, `emerald`, `amber`, `rose` |
| `<GlassButton />` | `components/glass-button.tsx` | Botón. Variantes: `primary`, `secondary`, `danger`, `ghost`. Tamaños: `sm`, `md`, `lg` |
| `<GlassInput />` | `components/glass-input.tsx` | Input estilo iOS consistente |
| `<StatusBadge />` | `components/status-badge.tsx` | Badge semántico. Soporta 15+ estados con labels en español |
| `<ConfirmDialog />` | `app/components/confirm-dialog.tsx` | Diálogo de confirmación glassmorphism |
| `<ChangePasswordModal />` | `components/change-password-modal.tsx` | Modal cambio de contraseña |
| `DashboardLayout` | `app/components/layouts/dashboard-layout.tsx` | Layout maestro (sidebar + header + chat + notificaciones) |

### Utilidades CSS glassmorphism definidas en `globals.css`

```css
/* Clases base */
.glass              → bg semitransparente + blur(24px) + saturate(180%) + border luminoso
.glass-card          → blur(30px) + saturate(200%) + border-top luminoso + rounded-[24px]
.glass-input         → blur(16px) + saturate(150%) + rounded-[1rem]
.liquid-glass        → efecto de líquido animado (pseudo-elemento rotante)

/* Gradientes por color (header, cards temáticas) */
.glass-gradient-header   → indigo → purple → pink
.glass-gradient-purple   → purple tones
.glass-gradient-blue     → blue → indigo
.glass-gradient-emerald  → emerald → green
.glass-gradient-amber    → amber → gold
.glass-gradient-rose     → rose → pink

/* Tabla */
.glass-table-header → header de tabla con gradiente sutil
.scrollable-table   → tabla con thead sticky + tbody scrollable
.scroll-modern      → scrollbar delgado con gradiente indigo/purple
```

> **TODAS** estas utilidades tienen sus variantes `.dark` definidas. Al usarlas, **no agregar estilos dark manuales** — ya están cubiertos.

### Variables CSS (oklch) — `:root` y `.dark`

```css
--primary: oklch(0.488 0.243 264.376)    /* iOS Blue */
--background: oklch(0.985 0 0)           /* Casi blanco */
--card: oklch(1 0 0 / 0.8)               /* Card transparente */
--border: oklch(0.145 0 0 / 0.15)        /* Borde sutil */
--radius: 1rem                           /* Radio base */
```

> Los radios derivados van desde `--radius-sm` (0.6x) hasta `--radius-4xl` (2.6x).

### Fondo de dashboard

```html
<!-- Agregar SIEMPRE dentro de las páginas de dashboard -->
<div className="dashboard-bg" />
```

> **Login ya tiene imagen de fondo**, no usa `.dashboard-bg`. Todas las demás vistas SÍ lo usan.

### Animaciones (Framer Motion) — Patrón estándar

```typescript
// Entrada estándar de elementos
<motion.div
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8, ease: 'easeOut' }}
>

// Con delay escalonado para listas
{items.map((item, i) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05 }}
  />
))}

// Escala para loaders/splash
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
/>
```

### Toasts (Sonner)

```typescript
import { toast } from 'sonner'

// Éxito
toast.success('Sucursal creada exitosamente')

// Error
toast.error('Error al crear la sucursal')

// Con acción
toast.message('¡Nuevo usuario registrado!', {
  description: 'Un nuevo usuario necesita activación.',
  duration: 10000,
  action: {
    label: 'Revisar',
    onClick: () => window.location.href = '/admin/usuarios',
  },
})
```

> Mensajes de toasts **siempre en español**.

### Modales — Patrón glassmorphism

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="glass border-border/50 rounded-3xl max-w-md">
    {/* ... */}
  </DialogContent>
</Dialog>
```

### Tablas con scroll moderno

```tsx
<div className="scrollable-table scroll-modern flex-1">
  <table>
    <thead>
      <tr className="glass-table-header">
        {/* Headers */}
      </tr>
    </thead>
    <tbody>
      {/* Rows */}
    </tbody>
  </table>
</div>
```

> Aplicar `.scrollable-table .scroll-modern` en **todas** las tablas, sidebar y dashboards.

---

## ⚡ REALTIME — ARQUITECTURA 100% TIEMPO REAL

### Principio fundamental

> En SM Restaurant PRO, **no existe polling**. Todo cambio de estado se propaga instantáneamente a todos los clientes conectados vía Supabase Realtime (PostgreSQL Changes).

### Canales Realtime activos en el sistema

| Canal | Tabla | Propósito |
|---|---|---|
| `profile-updates-{userId}` | `profiles` | Redirigir al usuario cuando le asignan rol |
| `global-user-status-guard-{userId}` | `profiles` | Expulsar usuario si es inactivado |
| `public:notifications` | `notifications` | Notificaciones push (nuevo usuario, rol asignado) |
| `chat-{channelId}` | `chat_messages` | Mensajes de chat en tiempo real |
| `orders-{branchId}` | `orders` | Estado de órdenes (mesero ↔ cocina ↔ caja) |
| `tables-{branchId}` | `tables` | Estado de mesas (libre/ocupada/reservada) |
| `kds-{branchId}` | `kds_queue` | Cola de cocina |

### Patrón obligatorio para suscripciones Realtime

```typescript
'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

function MiComponente({ branchId }: { branchId: string }) {
  const supabase = createClient()

  useEffect(() => {
    // 1. Nombre descriptivo y ÚNICO por componente/vista
    const channel = supabase
      .channel(`nombre-descriptivo-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',       // o 'INSERT' | 'UPDATE' | 'DELETE'
          schema: 'public',
          table: 'mi_tabla',
          filter: `branch_id=eq.${branchId}`,  // Filtro recomendado
        },
        (payload: { new: any }) => {
          // 2. Castear el payload al tipo correspondiente
          const updated = payload.new as MiTipo
          // 3. Actualizar estado local
          setData(prev => /* merge */)
        }
      )
      .subscribe((status: string) => {
        console.log(`[MiComponente] Realtime status:`, status)
      })

    // 4. SIEMPRE limpiar en el cleanup
    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, supabase])
}
```

### Reglas inquebrantables de Realtime

1. **Solo en Client Components** (`'use client'`) con `useEffect`
2. **Siempre** llamar `supabase.removeChannel(channel)` en el cleanup del `useEffect`
3. **Nombres de canales únicos** — usar template literals con IDs para evitar colisiones
4. **No duplicar suscripciones** — verificar que no haya canales repetidos por re-renders
5. **Listeners de visibilidad** como fallback — `document.visibilitychange` + `window.focus` para re-verificar estado al volver a la pestaña
6. **Heartbeat de seguridad** — para guards críticos (como `UserStatusGuard`), un `setInterval` de 60s como red de seguridad

### Guard de estado del usuario (`UserStatusGuard`)

Ubicado en `app/components/providers/client-providers.tsx`, este componente:
- Se monta **globalmente** en toda la app vía `ClientProviders`
- Escucha cambios Realtime en `profiles` para el usuario autenticado
- Si el usuario es inactivado (`user_status !== 'active'`) → `window.location.replace('/pending')`
- Tiene fallback con `visibilitychange`, `focus` y heartbeat cada 60s
- **No corre en rutas públicas** (`/login`, `/signup`, `/auth`, `/menu`, `/pending`)

---

## 🗄️ BASE DE DATOS (PostgreSQL + Supabase)

### Tablas principales por dominio

| Dominio | Tablas |
|---|---|
| **Usuarios** | `profiles`, `audit_logs` |
| **Sucursales** | `branches` |
| **Operación** | `zones`, `tables`, `orders`, `order_items`, `order_item_modifiers`, `customer_orders` |
| **Cocina** | `kitchen_stations`, `kds_queue` |
| **POS** | `cashier_sessions`, `cashier_movements`, `payments`, `discounts` |
| **Productos** | `product_categories`, `products`, `modifier_groups`, `modifiers`, `product_modifier_groups` |
| **Recetas** | `recipes`, `ingredients`, `cost_drivers`, `recipe_cost_history` |
| **Inventario** | `inventory`, `inventory_movements` |
| **Almacenes** | `warehouses`, `warehouse_transfers` |
| **Compras** | `suppliers`, `purchase_orders`, `purchase_order_items`, `accounts_payable`, `accounts_payable_payments` |
| **Recepción** | `reservations`, `waiting_list`, `whatsapp_messages` |
| **Fiscal** | `customers`, `invoices` |
| **Chat** | `chat_messages`, `notifications` |
| **Reportes IA** | `report_templates`, `report_logs` |
| **Configuración** | `system_settings` |

### Patrones de eliminación

```typescript
// Columnas requeridas en tablas con soft-delete:
deleted_at: TIMESTAMPTZ | null
deleted_by: UUID | null (referencia a auth.users)

// Al consultar, SIEMPRE filtrar:
.is('deleted_at', null)

// Al eliminar:
.update({ deleted_at: new Date().toISOString(), deleted_by: user?.id })
```

### RLS (Row Level Security)

- **Todas las tablas tienen RLS activo** — sin excepción
- Las políticas filtran automáticamente por `branch_id` del usuario autenticado
- `SUPER_ADMIN` tiene políticas permisivas **sin filtro de sucursal**
- Para comparaciones de enums en RLS, **castear a `text`** para evitar errores de transacción
- Al escribir migraciones SQL, usar siempre `IF NOT EXISTS` / `IF EXISTS` para idempotencia

### Triggers importantes

- `trg_discount_inventory` en `order_items` → Descuenta automáticamente del inventario al crear un ítem de orden
- Trigger de creación de perfil en `auth.users` → Crea registro en `profiles` al registrar usuario

---

## 🛡️ MIDDLEWARE Y PROTECCIÓN DE RUTAS

El archivo `middleware.ts` en la raíz protege **todas** las rutas:

```
Flujo de decisión:
1. ¿Es ruta de API? → Pasar sin validar
2. ¿Es ruta pública? → Permitir sin sesión
3. ¿No tiene sesión? → Redirect a /login
4. ¿Tiene sesión pero está en ruta pública (no /menu, no /auth/callback, no /pending)? → Redirect a /
5. ¿Perfil no existe o está inactivo? → Redirect a /pending
6. ¿No tiene rol + branch asignado? → Redirect a /pending
7. ¿Está en /? → Redirect al dashboard de su rol
8. ¿La ruta NO está en ROLE_ALLOWED_PREFIXES del rol? → ACCESS DENIED → Redirect al dashboard
9. ✅ Permitir acceso
```

> **⚠️ No toques el middleware sin entender el flujo completo de Auth y el mapa de roles.**

### Al agregar nuevas rutas:

1. Agregar el prefix en `ROLE_ALLOWED_PREFIXES` del `middleware.ts` para los roles que deben acceder
2. Si es ruta pública, agregarla a `PUBLIC_PATHS`
3. Agregar la entrada correspondiente en `NAV_ITEMS` del `dashboard-layout.tsx`

---

## 🧩 PROVIDERS Y CONTEXTO GLOBAL

### `ClientProviders` (raíz de la app)

```tsx
<BranchProvider>       {/* Context de sucursal activa (sessionStorage) */}
  <UserStatusGuard />  {/* Guard Realtime de estado del usuario */}
  {children}
</BranchProvider>
```

### `BranchProvider` / `useBranch()`

- Almacena la sucursal seleccionada en `sessionStorage` bajo key `sm_current_branch`
- Acceder vía hook: `const { currentBranch, setBranch, branchId } = useBranch()`
- Usado en POS, Mesero, y cualquier vista que dependa de sucursal

### `DashboardLayout`

Layout maestro que incluye:
- **Sidebar** glassmorphism con navegación filtrada por rol
- **Header** con logo, nombre de sucursal, avatar y menú de usuario
- **Dark mode toggle** (Moon/Sun)
- **Chat flotante** con `ChatPanel` + `ChatFloatingButton`
- **NotificationListener** para notificaciones push Realtime
- **Responsive** con `Sheet` (drawer) para mobile

---

## 📋 PATRONES DE CRUD — REFERENCIA

### Estructura de archivos por módulo CRUD

```
/app/mi-modulo/
  page.tsx         → Server Component (fetch inicial) + Client Component (tabla, modales, Realtime)
  actions.ts       → Server Actions (create, update, delete, get)
```

### Patrón de Server Action

```typescript
'use server'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getEntities() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mi_tabla')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  return data
}

export async function createEntity(formData: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const { data, error } = await supabase
    .from('mi_tabla')
    .insert([{ ...formData }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/mi-modulo')
  return data
}
```

### Patrón de página CRUD con Realtime

```typescript
// page.tsx — Server Component wrapper
import { getEntities } from './actions'
import { EntityClient } from './entity-client'

export default async function EntitiesPage() {
  const entities = await getEntities()
  return <EntityClient initialData={entities} />
}

// entity-client.tsx — Client Component
'use client'
export function EntityClient({ initialData }) {
  const [data, setData] = useState(initialData)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('entities-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mi_tabla' },
        (payload) => { /* merge updates */ }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // ... render tabla, modales, formularios
}
```

---

## 🚀 COMANDOS DE DESARROLLO

```bash
# Iniciar servidor de desarrollo (accesible en LAN)
npm run dev          # Corre: next dev -H 0.0.0.0

# Build de producción
npm run build

# Lint
npm run lint
```

> El servidor corre en `http://localhost:3000` por defecto.
> Para acceso desde otros dispositivos en LAN: `http://<IP_LOCAL>:3000`
> IP permitida en `next.config.ts`: `192.168.1.161`

---

## 📋 ESTADO ACTUAL DEL PROYECTO

### ✅ Implementado y funcionando

- **Autenticación completa**: Login, Sign-Up, Google OAuth, Forgot Password, Reset Password
- **Callback** `/auth/callback` con soporte PKCE
- **`HomeAuthHandler`** con Realtime: detecta rol y redirige automáticamente
- **`UserStatusGuard`**: expulsión en tiempo real de usuarios inactivados
- **Pantalla de espera** (`/pending`) para usuarios sin rol
- **Página 404** personalizada en español
- **Layout maestro** `DashboardLayout` con sidebar glassmorphism + dark mode + chat
- **CRUD de Usuarios** (`/admin/usuarios`) con Realtime
- **CRUD de Sucursales** (`/admin/sucursales`) con soft-delete
- **CRUD de Productos y Categorías** (`/admin/productos`, `/admin/categorias`)
- **CRUD de Mesas y Zonas** (`/admin/mesas`)
- **Menú Digital público** (`/menu`)
- **Sistema de Chat** interno con Realtime
- **Notificaciones** push Realtime (nuevo usuario, rol asignado)
- **Super Admin Dashboard** (`/super-admin`) con métricas globales
- **Inventario** (almacenes, insumos, existencias, movimientos)
- **Recetas** con costeo (ingredientes + labor + servicios)
- **Proveedores** y **Compras** (órdenes de compra, recepción)
- **Cuentas por Pagar** con pagos parciales
- **Recepción** (reservaciones, lista de espera)
- **POS** (apertura de caja, cobro)
- **Configuración** general del sistema
- **Mi Cuenta** (perfil del usuario)

### 🔄 En desarrollo / pendiente

Ver `plan/plan.md` para el roadmap completo por fases.

---

## 📝 REGLAS FINALES PARA AGENTES

### Antes de crear algo nuevo

1. **Verificar si ya existe** un componente similar en `/components/`, `/components/ui/`, o `/app/components/`
2. **Verificar si el tipo ya está definido** en `/lib/types.ts`
3. **Verificar si la ruta ya tiene permisos** en `middleware.ts` → `ROLE_ALLOWED_PREFIXES`

### Al modificar la base de datos

1. Revisar `plan/plan.md` para contexto
2. SQL siempre idempotente: `IF NOT EXISTS`, `IF EXISTS`, `CREATE OR REPLACE`
3. Agregar RLS policies para la nueva tabla
4. Agregar el tipo TypeScript correspondiente en `/lib/types.ts`

### Al crear nuevas rutas

1. Actualizar `ROLE_ALLOWED_PREFIXES` en `middleware.ts`
2. Agregar entrada en `NAV_ITEMS` de `dashboard-layout.tsx`
3. Incluir `SUPER_ADMIN` en el array de roles siempre (acceso global)

### Convenciones de UI

1. **Fondo**: Usar `<div className="dashboard-bg" />` en dashboards (NO en Login que tiene imagen)
2. **Cards**: Usar `<GlassCard variant="..." />` o la clase `glass-card`
3. **Botones**: Usar `<GlassButton variant="primary|secondary|danger|ghost" />`
4. **Tablas**: Usar `.scrollable-table .scroll-modern` para scroll moderno
5. **Modales**: Clase `glass border-border/50 rounded-3xl` en `DialogContent`
6. **Badges**: Usar `<StatusBadge status="..." />` — soporta 15+ estados
7. **Animaciones**: Framer Motion en TODA entrada de elementos (`opacity 0→1`, `y: 30→0`)
8. **Confirmaciones destructivas**: Usar `<ConfirmDialog variant="destructive" />`
9. **Toasts**: `import { toast } from 'sonner'` — mensajes siempre en español

### Lo que NUNCA debes hacer

- ❌ Usar `"use client"` sin necesidad real
- ❌ Hacer `DELETE FROM` en tablas de negocio
- ❌ Queries sin `.is('deleted_at', null)`
- ❌ Hardcodear IDs de sucursal o usuario
- ❌ Crear canales Realtime sin cleanup
- ❌ Tocar `middleware.ts` sin entender el flujo completo
- ❌ Usar `any` sin casteo explícito (excepto payloads Realtime que se castean)
- ❌ Ignorar las variantes `.dark` del sistema de diseño
- ❌ Crear componentes duplicados que ya existen en el sistema
- ❌ Mensajes de UI en inglés
