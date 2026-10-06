# Panel de Administración
### Para el dueño de la plataforma

App separada dentro del monorepo: `apps/admin`. Mismo proyecto de Supabase que `apps/web`,
pero con acceso restringido por `profiles.is_platform_admin = true` (ver RLS en `schema.sql`).

---

## 1. Acceso

- Login con Supabase Auth (mismo sistema, sin passkeys obligatorias aquí — puede añadirse después).
- Middleware de `apps/admin` verifica `is_platform_admin` en cada request; si es `false`, redirige a una página de "acceso no autorizado" (nunca a la app de usuarios, para no confundir contextos).
- Recomendado: 2FA obligatorio para esta app, dado que administra pagos y datos de usuarios (Supabase Auth soporta MFA nativo — se activa en la configuración del proyecto).

---

## 2. Pantallas principales

### 2.1 Dashboard (home)
- Tarjetas de métricas clave:
  - Usuarios totales / nuevos en los últimos 7 y 30 días.
  - Suscripciones activas (individuales vs. organizacionales).
  - Ingreso recurrente mensual estimado (MRR), calculado a partir de `subscriptions` + `plans`.
  - Sesiones de ejecución activas en este momento (`sessions.status = 'playing'`).
  - Partituras más usadas (join `sessions` → `work_versions` → `works`, agrupado por `work_id`).
- Gráfica de altas/bajas de suscripción en el tiempo (Recharts, ya disponible en el stack de artifacts pero aquí se usaría directamente en la app real vía la misma librería).

### 2.2 Usuarios
- Tabla con búsqueda/filtro (nombre, email, fecha de registro, estado de suscripción).
- Acción: **suspender/reinstalar** usuario (inserta en `moderation_actions`, actualiza `profiles.is_suspended`).
- Detalle de usuario: historial de suscripciones, partituras subidas, sesiones creadas.

### 2.3 Suscripciones
- Lista sincronizada con Stripe (vía `subscriptions` + datos en vivo de la API de Stripe si se requiere detalle de facturación).
- Filtros por estado (`active`, `past_due`, `canceled`).
- Acceso directo al registro correspondiente en el Dashboard de Stripe (link externo) para casos que requieran intervención manual.

### 2.4 Organizaciones
- Lista de organizaciones, dueño, asientos usados/disponibles (`organization_members` vs `seats_limit`).
- Permite ajustar manualmente el límite de asientos en casos de soporte/excepciones comerciales.

### 2.5 Moderación de contenido
- Lista de partituras reportadas o marcadas para revisión (requiere, como mejora futura, un botón de "reportar" visible para usuarios finales — no estaba en el alcance original, se puede añadir en backlog).
- Acción: dar de baja una partitura (`moderation_actions`, `target_type = 'score'`), notificando al usuario dueño por email.

### 2.6 Notificaciones
- Panel de notificaciones en tiempo real (nuevo usuario, nueva suscripción, cancelación), poblado desde la tabla `admin_notifications`.
- Suscripción a `postgres_changes` de Supabase Realtime sobre `admin_notifications` para mostrar **Toast** inmediato sin necesidad de recargar.
- Marcar como leídas / archivar.

---

## 3. Flujo de notificación en tiempo real (nuevo usuario)

```
1. Usuario se registra → trigger de Postgres "after insert on profiles"
2. Trigger llama a una función (pg_net o Edge Function) que:
   a) Inserta un registro en admin_notifications (type = 'new_user')
   b) Envía email vía SMTP de Gmail (Nodemailer desde una Edge Function)
3. apps/admin tiene un canal de Supabase Realtime suscrito a admin_notifications
   → recibe el INSERT → muestra Toast inmediato + incrementa contador de "no leídas"
```

**Nota sobre el SMTP de Gmail:** tiene un límite de envío diario (~500 correos/día en cuentas normales de Gmail, más en Google Workspace). Para el volumen inicial de un MVP esto es más que suficiente; si el número de registros diarios se acerca a ese límite, migrar a Resend o SendGrid sin cambiar la lógica de negocio (solo el transporte del email).

---

## 4. Métricas — consultas de referencia

Ejemplos de las consultas que alimentan el Dashboard (sobre el esquema ya definido en `schema.sql`):

```sql
-- Usuarios nuevos últimos 7 días
select count(*) from profiles where created_at >= now() - interval '7 days';

-- Suscripciones activas por tipo de plan
select p.plan_type, count(*)
from subscriptions s
join plans p on p.id = s.plan_id
where s.status = 'active'
group by p.plan_type;

-- Sesiones activas ahora mismo
select count(*) from sessions where status = 'playing';

-- Obras más usadas (top 10)
select w.title, count(*) as veces_ejecutada
from sessions s
join work_versions wv on wv.id = s.work_version_id
join works w on w.id = wv.work_id
group by w.title
order by veces_ejecutada desc
limit 10;
```

---

## 5. Seguridad específica del panel

- Ninguna escritura sensible (cambios de suscripción, moderación) se hace solo con RLS del cliente; las acciones críticas (suspender usuario, dar de baja partitura) pasan por **Server Actions de Next.js** que verifican `is_platform_admin` en el servidor antes de ejecutar, como capa adicional a RLS.
- Los webhooks de Stripe nunca son alcanzables ni simulables desde `apps/admin` directamente — viven en `apps/web` (o Edge Functions) con su propio secreto de verificación de firma.

---

## 6. Próximo paso

Con esto quedan cubiertos: plan funcional, modelo de datos, arquitectura técnica y panel de administración. Cuando quieras, seguimos con:

1. **Especificación de pantallas de `apps/web`** (wireframes funcionales: login, biblioteca, subida/marcado manual, sala de sesión Director/Ejecutante).
2. El **plan de marketing y SEO**, cuando tú lo indiques (como acordamos, al final).
