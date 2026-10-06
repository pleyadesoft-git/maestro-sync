# Plan Funcional Completo — App de Lectura Sincronizada de Partituras
### (Nombre provisional: "MaestroSync" — a definir)

---

## 0. Resumen ejecutivo

Aplicación web progresiva (PWA) que permite a orquestas y agrupaciones musicales leer partituras de forma digital y sincronizada. Un usuario con rol de **Director** controla en tiempo real el avance (play/pause/stop/retroceso) de la partitura en todos los dispositivos de los **Ejecutantes** conectados a la sesión, resaltando automáticamente el pentagrama correspondiente al instrumento de cada músico, eliminando la necesidad de pasar hojas manualmente.

---

## 1. Roles y modelo de sesión

| Rol | Alcance | Reglas |
|---|---|---|
| **Director** | Por sesión (efímera, ad-hoc) | Solo 1 activo por sesión. Controla play/pause/stop/seek y tempo. |
| **Ejecutante** | Por sesión | Ilimitados. Selecciona su instrumento al entrar. Solo lectura del avance. |
| **Admin (tú)** | Global | Panel separado, gestión de usuarios, suscripciones, moderación. |

**Ciclo de vida de una sesión:**
1. Cualquier usuario crea una sesión → se le asigna rol Director automáticamente y la app genera un **código de sala** (alfanumérico corto, ej. `MZ7K-2Q`).
2. Otros músicos ingresan el código → entran como Ejecutante y seleccionan su instrumento.
3. Solo puede haber un Director por sesión; si el creador cierra sesión, la sala queda huérfana (se cierra) — *(a definir en detalle: ¿se puede transferir el rol de Director a otro músico conectado si el Director original se desconecta? Lo dejo como pregunta abierta, ver sección 12).* 
4. La sesión es efímera: no se persiste como "orquesta" en base de datos, solo el código, sus participantes activos y el estado de reproducción (vía Supabase Realtime channel).

---

## 2. Gestión de partituras

### 2.1 Subida
- Formatos aceptados: **PDF multipágina** e **imágenes** (JPG/PNG).
- Se almacenan en **Supabase Storage** (bucket privado por usuario).
- Metadatos capturados en el registro:
  - Obra, autor/compositor, fecha, **referencia de catálogo** (BWV, K., Op., etc.), instrumentación, tonalidad, compás (time signature), **tempo por defecto (BPM)**, número total de compases.
- El tempo y el número de compases son editables en cualquier momento por el propietario de la partitura (para corregir el cálculo de duración por renglón).

### 2.2 OCR / Reconocimiento óptico de música (OMR)
- Se aplica reconocimiento óptico de música (**OMR — Optical Music Recognition**, distinto del OCR de texto) para identificar pentagramas, compases, notas y escalas.
- **Nota técnica importante:** el reconocimiento de notación musical es significativamente más complejo que el OCR de texto. Recomiendo usar un motor especializado ya existente en lugar de construir uno desde cero (ej. Audiveris, integraciones vía API de reconocimiento musical, o servicios comerciales de OMR). Esto se evaluará en la fase de arquitectura técnica.
- El resultado del OMR se guarda estructurado en base de datos, relacionado con la partitura:
  - Página → Sistema/pentagrama → Instrumento asignado → Compases contenidos → Coordenadas (bounding box) dentro de la imagen/PDF, para poder dibujar el highlight.
- Este resultado es lo que permite generar el **mapa de sincronización** (qué pentagrama se ilumina en qué momento, para qué instrumento).

### 2.3 Corrección manual del mapa de sincronización
- Como el OMR puede cometer errores, debe existir una vista de "editor de sincronización" donde el propietario de la partitura pueda:
  - Ajustar manualmente los límites de cada pentagrama detectado.
  - Reasignar a qué instrumento pertenece cada línea (en partituras generales con múltiples instrumentos por sistema).
  - Confirmar/corregir el número de compases por pentagrama (esto alimenta el cálculo del tiempo real de highlight).

### 2.4 Filtros de biblioteca
- Obra, autor, fecha de subida, referencia de catálogo, instrumentación, tonalidad.
- Las partituras son **privadas por usuario** (no hay biblioteca compartida entre usuarios).
- Se admite **control de versiones**: una misma obra puede tener múltiples ediciones/arreglos vinculados entre sí.

---

## 3. Visualización y modo de lectura

- Cada músico, al entrar a una sesión, **selecciona su instrumento**.
- Todos ven la **partitura completa** (todos los instrumentos, como una partitura general), pero el **highlight** solo resalta el pentagrama correspondiente al instrumento seleccionado por ese músico.
- El highlight se hace **por pentagrama/sistema**, no por página completa, dando referencia visual precisa de qué compases se están ejecutando.
- El desplazamiento de página/scroll debe ser automático cuando el highlight avanza más allá del pentagrama visible.

---

## 4. Reproducción y control (Director)

- Controles: **Play, Pause, Stop**.
- Selector de **tempo** (BPM), pre-cargado desde el metadato de la partitura pero **editable en vivo** por el Director antes o durante la ejecución.
- Cálculo de duración de cada pentagrama = (número de compases del pentagrama ÷ tempo) ajustado por compás (time signature), usando los metadatos corregidos manualmente si aplica.
- Al pausar, el Director puede:
  - Reanudar exactamente donde se quedó, o
  - **Retroceder/saltar a un compás específico** (seek manual), y ese cambio se propaga a todos los ejecutantes.
- Todo cambio de estado (play/pause/stop/seek/tempo) se transmite en tiempo real vía **Supabase Realtime** a todos los clientes conectados a la sesión.

---

## 5. Sincronización en tiempo real

- Tecnología: **Supabase Realtime** (channels + broadcast/presence).
- El Director publica eventos de estado (`play`, `pause`, `stop`, `seek:compás`, `tempo:bpm`) al canal de la sesión.
- Los Ejecutantes se suscriben al canal y actualizan su highlight localmente en función del reloj sincronizado (se recomienda usar un timestamp de referencia + cálculo local, no solo eventos discretos, para evitar drift de sincronización entre dispositivos).
- **Reconexión:** si un músico pierde conexión, al reconectar el cliente debe solicitar el estado actual de la sesión (posición actual, tempo, estado play/pause) y re-sincronizar inmediatamente, sin intervención del Director.
- Presencia (Supabase Presence) se usa para mostrar quién está conectado y qué instrumento tiene seleccionado cada uno (visible para el Director).

---

## 6. Autenticación

- Supabase Auth con proveedores:
  - Google
  - Apple
  - Email/contraseña
  - **Passkeys / WebAuthn** para biometría (Face ID / Touch ID / Windows Hello), como método adicional de inicio de sesión rápido en dispositivos compatibles.

---

## 7. Suscripciones y monetización

- **Tier gratuito:** hasta 2 partituras almacenadas.
- **Tier de pago (mensual o anual, cancelable en cualquier momento):**
  - **Plan individual**: un usuario paga por su propia cuenta.
  - **Plan organizacional/orquesta**: un solo pago cubre a un grupo de usuarios bajo una misma entidad de facturación.
  - Mismo precio de acceso funcional sin diferenciar por rol (Director/Ejecutante).
- Procesador de pagos: **Stripe** (checkout, portal de cliente para autogestión de cancelación, webhooks para sincronizar estado de suscripción con Supabase).

*(Pendiente de definir en detalle antes de modelar base de datos: mecánica exacta del plan organizacional — ¿cómo se asignan/invitan miembros a una cuenta organizacional y hay límite de asientos por plan? Ver preguntas abiertas en sección 12).*

---

## 8. Panel de administración (para ti, dueño de la app)

- Métricas de uso: sesiones activas, partituras más usadas, usuarios activos, altas de suscripción, cancelaciones.
- Gestión y monitoreo de suscripciones (estado, historial de pagos vía Stripe).
- **Notificaciones en tiempo real** de nuevo usuario registrado:
  - Dentro del panel: Toast/notificación vía Supabase Realtime.
  - Por correo: email transaccional enviado vía **SMTP de Gmail** (se configurará con contraseña de aplicación de Google, ya que Gmail SMTP tiene límites de envío diario — a considerar si el volumen crece, migrar a un proveedor transaccional como Resend/SendGrid).
- Moderación: capacidad de suspender/banear usuarios y de dar de baja partituras subidas (por ejemplo, ante reclamos de derechos de autor).

---

## 9. Internacionalización (i18n)

- Idiomas de lanzamiton: **Español e Inglés** (prioritarios) más los siguientes para cubrir "los 10 idiomas más hablados/relevantes":
  - Mandarín, Hindi, Francés, Árabe, Portugués, Bengalí, Ruso, Japonés, Alemán.
- Implementación con librería i18n estándar de Next.js (ej. `next-intl` o `next-i18next`), con detección automática de idioma del navegador/dispositivo y selector manual.

---

## 10. UI/UX

- Estilo visual siguiendo **Apple Human Interface Guidelines**, adaptado con **Tailwind CSS + ShadCN/UI**.
- Minimalista, moderno, alto contraste para lectura en tablets en condiciones de poca luz (atriles).
- Responsivo, con foco principal en **tablets** (uso real en atril) pero adaptable a móvil y escritorio.
- Modo oscuro / claro.
- Animaciones de transición del highlight con **Framer Motion** (suave, no distractivo durante la ejecución).

---

## 11. PWA

- Instalable como PWA con actualizaciones automáticas (service worker con estrategia de "stale-while-revalidate" o "network-first" para assets críticos).
- Offline-first parcial: partituras ya descargadas/cacheadas deben poder visualizarse sin conexión (aunque la sincronización en vivo requiere red).
- Wrapper nativo con **Capacitor** planeado como fase futura (no en esta versión).

---

## 12. Aspecto legal

- El usuario es el único responsable de la legalidad de las partituras que sube (propiedad, dominio público, licencia de uso).
- La aplicación se deslinda de responsabilidad por contenido protegido por derechos de autor subido por usuarios.
- Se recomienda incluir Términos de Servicio explícitos y un mecanismo de reporte/DMCA takedown accesible desde el panel de administración (moderación, sección 8).

---

## 13. Stack tecnológico propuesto

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (última versión estable), Tailwind CSS, ShadCN/UI, Framer Motion |
| Backend / DB | Supabase (Postgres, Auth, Storage, Realtime) |
| Pagos | Stripe (Checkout + Customer Portal + Webhooks) |
| OMR | Motor especializado de reconocimiento de notación musical (a evaluar/seleccionar) |
| Email admin | SMTP de Gmail (fase inicial) |
| i18n | next-intl / next-i18next |
| PWA | next-pwa o Workbox |
| Hosting | Vercel (recomendado por integración nativa con Next.js) |

---

## 14. Resolución de puntos abiertos

### 14.1 Transferencia de rol de Director
Confirmado: si el Director se desconecta, la sesión **no se cierra**; el control puede **transferirse a otro Ejecutante conectado**.
- Regla propuesta: al detectar la desconexión del Director (vía Supabase Presence, evento `leave`), la app ofrece a los Ejecutantes conectados un botón "Tomar control de Director" (o el propio Director, antes de salir, puede transferir el rol manualmente a alguien específico de la lista de conectados).
- Solo puede haber un Director activo a la vez; si dos intentan tomar el control simultáneamente, gana el primer request confirmado por el servidor (evitar condición de carrera con una función/RPC atómica en Supabase, no solo lógica de cliente).
- El estado de reproducción (posición, tempo, play/pause) se conserva durante la transferencia; no se reinicia.

### 14.2 Plan organizacional con asientos fijos
Confirmado: el plan de orquesta/organización tiene **número fijo de asientos** (ej. planes de 10, 20, 30 músicos — los rangos exactos de precio se definen en la fase de negocio/pricing, no ahora).
- El pagador (dueño de la cuenta organizacional) genera **invitaciones** (código o enlace) para llenar los asientos disponibles.
- Si se alcanza el límite de asientos, no se pueden agregar más miembros hasta hacer upgrade de plan o liberar un asiento (remover a un miembro).
- Esto sí impacta el modelo de datos: necesitaremos una tabla `organizations`, `organization_members` y `organization_seats_limit` ligada al plan de Stripe.

### 14.3 Motor de OMR — Propuesta de opciones

| Opción | Tipo | Pros | Contras |
|---|---|---|---|
| **Audiveris** | Open source (Java) | Maduro, muchos años de desarrollo, buen reconocimiento en partituras impresas de calidad razonable (tipo IMSLP), soporta partituras grandes (cientos de páginas), incluye su propio editor de corrección de errores que podemos usar como referencia de UX. | No es una API nativa lista para producción web: hay que exponerlo como microservicio (ej. contenedor Docker + cola de trabajos), procesamiento no es instantáneo, requiere infraestructura propia (no vive en Supabase). |
| **oemer** | Open source (Python) | Ligero, pensado para fotos tomadas con celular (no solo escaneos), exporta directo a MusicXML, fácil de correr como servicio serverless/contenedor. | Proyecto más joven y con menos mantenimiento activo que Audiveris; precisión variable en partituras complejas con múltiples voces/instrumentos por sistema. |
| **Halbestunde OMR API** | Comercial (SaaS) | API lista para producción, pensada para apps móviles/web de terceros, soporta múltiples instrumentos y varios símbolos musicales, tiempos de procesamiento reportados de segundos por partitura. | Costo por uso/licencia (a cotizar directamente con el proveedor), dependencia de un tercero externo para una función crítica del producto. |
| **PlayScore (API/SDK)** | Comercial | Reconocido en el mercado de apps de lectura musical, buena precisión reportada en partituras impresas. | Enfocado históricamente en playback (convertir a sonido) más que en generar mapas de highlighting por pentagrama; habría que validar si su output (MusicXML/posiciones) es suficientemente granular para nuestro caso de uso. |

**Mi recomendación para el MVP:** empezar con **oemer** (open source, gratuito, exporta MusicXML) corriendo como microservicio propio (contenedor en un droplet/Railway/Fly.io, con un job queue que se comunique con Supabase), y dejar la puerta abierta a migrar a una API comercial (Halbestunde) si la precisión no es suficiente para el catálogo real de partituras de los usuarios. Como el editor de corrección manual (14.4) queda en fase 2 y no en el MVP, es aún más importante ser realistas: en la v1 el output del OMR se usará como una *sugerencia* de dónde están los pentagramas, pero con marcado manual simple como respaldo (ver 14.4).

*(Nota honesta: ningún motor de OMR actual garantiza 100% de precisión, especialmente en partituras con mala calidad de escaneo o notación manuscrita. Esto es una limitación técnica real de la industria, no solo de nuestra implementación.)*

### 14.4 Editor de corrección manual del OMR → Fase 2
Confirmado: no va en el MVP.
- **Para el MVP (v1)**, en lugar del editor de corrección visual completo, se implementa un **marcado manual simple**: al subir la partitura, el propio usuario (o el OMR de forma automática como sugerencia) define los puntos de corte de cada pentagrama de forma básica — por ejemplo, indicando cuántos compases tiene cada sistema y, si el OMR falla, ajustando solo el número de compases por pentagrama (sin edición visual de bounding boxes).
- El **editor visual avanzado** (mover/ajustar cajas del pentagrama sobre la imagen, reasignar instrumento por línea) se construye en **fase 2**, una vez validado el producto con usuarios reales.

---

## 15. Próximos pasos

1. Modelo de datos PostgreSQL completo (tablas, relaciones, políticas RLS de Supabase).
2. Arquitectura técnica detallada (estructura de carpetas Next.js, contratos de Realtime, flujo de Stripe/webhooks).
3. Especificación de pantallas y componentes (wireframes funcionales).
4. Panel de administración (modelo de datos + pantallas).
5. Plan de marketing y SEO (cuando tú lo indiques).

---

# PROMPT MAESTRO
### (Para usar como especificación consolidada en el desarrollo, con IA o con un equipo humano)

```
Desarrolla una aplicación web PWA llamada [NOMBRE A DEFINIR] para lectura sincronizada de
partituras musicales en orquestas y agrupaciones.

STACK: Next.js (última versión), Tailwind CSS, ShadCN/UI, Framer Motion, Supabase
(Postgres + Auth + Storage + Realtime), Stripe, i18n (next-intl), PWA con actualizaciones
automáticas.

ROLES:
- Director: único por sesión, controla play/pause/stop/seek/tempo en tiempo real.
- Ejecutante: ilimitados por sesión, selecciona su instrumento, visualiza la partitura
  completa con highlight automático solo en su pentagrama.
- Admin: panel separado para gestión de usuarios, suscripciones y moderación.

SESIONES: efímeras y ad-hoc, creadas por cualquier usuario (queda como Director), unión
de otros músicos vía código de sala. Reconexión automática con re-sincronización de
estado (posición, tempo, play/pause) al recuperar conexión. Si el Director se
desconecta, el rol se puede transferir a otro Ejecutante conectado (manual o por
solicitud), sin perder el estado de reproducción ni reiniciar la sesión.

PARTITURAS: subida como PDF multipágina o imagen a Supabase Storage (privado por
usuario). Metadatos: obra, autor, fecha, referencia de catálogo, instrumentación,
tonalidad, compás, tempo (BPM editable), número de compases (editable). Procesamiento
con OMR (reconocimiento óptico de notación musical) para detectar pentagramas por
instrumento y generar mapa de sincronización (pentagrama → compases → instrumento →
coordenadas). El motor de OMR recomendado para el MVP es oemer (open source), con
Audiveris/Halbestunde como alternativas evaluables. El editor visual de corrección de
OMR queda para fase 2; en el MVP el ajuste manual se limita a corregir el número de
compases por pentagrama. Control de versiones por obra. Biblioteca
filtrable por obra/autor/fecha/referencia/instrumentación/tonalidad, privada por usuario.

SINCRONIZACIÓN: Supabase Realtime (broadcast + presence). El Director emite eventos de
estado; los Ejecutantes calculan localmente el avance del highlight usando un timestamp
de referencia para evitar drift. Highlight por pentagrama con animación suave
(Framer Motion), con scroll/paginación automática.

AUTENTICACIÓN: Supabase Auth (Google, Apple, email) + Passkeys/WebAuthn para biometría.

SUSCRIPCIONES: Stripe. Tier gratuito hasta 2 partituras. Tier de pago mensual/anual,
cancelable, con plan individual y plan organizacional de **asientos fijos** (el pagador
invita miembros hasta llenar el cupo del plan contratado). Mismo precio funcional, sin
diferencia entre Director/Ejecutante.

PANEL ADMIN: métricas de uso, gestión de suscripciones vía Stripe, notificaciones en
tiempo real (toast interno vía Supabase Realtime + email transaccional vía SMTP de
Gmail) de nuevos registros, moderación (suspender usuarios/partituras).

UI/UX: estilo Apple Human Interface Guidelines adaptado con Tailwind + ShadCN,
minimalista, responsivo, optimizado para tablets en atril, modo claro/oscuro.

I18N: español e inglés prioritarios, más mandarín, hindi, francés, árabe, portugués,
bengalí, ruso, japonés y alemán.

LEGAL: el usuario es responsable de la legalidad de las partituras subidas; la
aplicación se deslinda de infracciones de derechos de autor de terceros.

FASE FUTURA (no en v1): wrapper nativo con Capacitor para tiendas de aplicaciones.
```

---

**Siguiente paso sugerido:** responde la sección 14 (4 preguntas abiertas) y avanzamos directo al modelo de datos PostgreSQL.
