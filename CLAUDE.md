# MAESTROSYNC (MUSIC-FLOW) — CLAUDE.md

> Guía de contexto rápido para Claude y asistentes de IA.
> La fuente de verdad completa y exhaustiva del proyecto está documentada en [AGENTS.md](./AGENTS.md).

---

## ⚠️ REGLAS CRÍTICAS

1. **Monorepo Turborepo con pnpm**: Paquetes internos con `"workspace:*"` (`@music-flow/ui`, `@music-flow/supabase`, `@music-flow/stores`, `@music-flow/i18n`, `@music-flow/stripe`, `@music-flow/config`).
2. **Next.js 16.3 + React 19**: App Router con Turbopack. `apps/web` (puerto 3002) y `apps/admin` (puerto 3001).
3. **Sincronización Realtime Milimétrica sin Drift**: Director ↔ Ejecutantes vía Supabase Realtime (canales `session:{room_code}` con `broadcast` y `presence`) + timestamp (`playback_started_at`) + `requestAnimationFrame`. No saturar con mensajes por compás.
4. **Resaltado por Pentagrama (`HighlightOverlay`)**: Coordenadas normalizadas 0.0 - 1.0 (`bbox_x`, `bbox_y`, `bbox_w`, `bbox_h`). Cada músico solo ve resaltado el pentagrama de su instrumento.
5. **MVP sin OMR Automático**: Marcado de pentagramas y compases manual (`is_manually_corrected = true`) en `/upload`.
6. **RLS Activo al 100%**: Partituras estrictamente privadas por usuario (`owner_id = auth.uid()`). `createServiceRoleClient()` exclusivo para webhooks de Stripe y backend administrativo.
7. **Diseño Stand-Ready (Alto Contraste y Dark Mode)**: Fondo `#0b0f17`, superficies `#0f172a`, acentos ámbar `#f59e0b`. Deshabilitar zoom táctil accidental (`userScalable: false`).
8. **Internacionalización**: Rutas `/[locale]/...` con `next-intl` (Español e Inglés prioritarios).

---

## 🚀 COMANDOS PRINCIPALES

```bash
pnpm dev         # Inicia apps/web (3002) y apps/admin (3001) vía Turbo
pnpm dev:web     # Inicia únicamente apps/web (3002)
pnpm dev:admin   # Inicia únicamente apps/admin (3001)
pnpm build       # Build de producción de todo el monorepo
pnpm lint        # Linter con ESLint 9 en todo el monorepo
```

Consulta [AGENTS.md](./AGENTS.md) para el detalle completo de arquitectura, esquema de base de datos y convenciones.
