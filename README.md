# MaestroSync — Music Flow

PWA de **lectura de partituras sincronizada** para orquestas y ensambles:
un Director controla Play/Pause/Seek/Tempo en vivo y los ejecutantes se unen
por código de sala, viendo resaltado únicamente su pentagrama.

Monorepo **Turborepo + pnpm** (Next.js 16 · React 19 · Supabase · Stripe).

## Estructura

| Ruta | Descripción | Puerto |
|---|---|---|
| `apps/web` | App principal (Director / Ejecutantes) | 3002 |
| `apps/admin` | Panel de administración | 3001 |
| `packages/*` | `ui`, `stores`, `supabase`, `stripe`, `i18n`, `config` |
| `supabase/schema.sql` | DDL completo + RLS + triggers | — |

## Puesta en marcha

```bash
pnpm install                      # 1. dependencias
cp .env.example .env              # 2. credenciales (Supabase y Stripe)
# 3. ejecutar supabase/schema.sql en tu proyecto Supabase
pnpm dev                          # 4. web + admin en simultáneo
```

## Comandos

```bash
pnpm dev          # ambos apps
pnpm dev:web      # web  → http://localhost:3002
pnpm dev:admin    # admin → http://localhost:3001
pnpm build        # build de producción
pnpm lint         # eslint en todo el monorepo
pnpm typecheck    # tsc --noEmit en apps y packages
```

## Documentación

- `AGENTS.md` — fuente de verdad de convenciones y arquitectura.
- `md-files/analisis-estado-del-proyecto.md` — análisis de estado, bugs y plan de remediación.
- `md-files/` — arquitectura técnica, plan funcional y panel de administración.
