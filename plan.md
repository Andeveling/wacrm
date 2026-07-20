# Plan: reorganización server-first del listado de contactos

> **Estado:** publicada como [GitHub issue #1](https://github.com/Andeveling/wacrm/issues/1).
>
> La implementación y la división en tickets quedan pendientes hasta después de publicar esta especificación.

## Problem Statement

La página de contactos concentra en un único Client Component la carga de contactos y etiquetas, búsqueda, filtros, paginación, selección masiva, mutaciones, permisos, diálogos y renderizado. Esta forma dificulta entender y probar el flujo, envía al cliente más JavaScript del necesario y obliga a coordinar manualmente consultas, respuestas fuera de orden y refrescos posteriores a cada mutación.

La búsqueda, los filtros por etiquetas y la página viven únicamente en memoria. Por ello, una vista no se puede compartir ni restaurar mediante la URL, y la navegación back/forward no representa los cambios realizados por el usuario. La consulta también bifurca entre PostgREST y una RPC según existan etiquetas, y luego necesita otra lectura para enriquecer cada contacto con sus etiquetas.

La acción actual denominada “eliminar” realiza un borrado físico que puede destruir conversaciones y mensajes relacionados. Durante el diseño se decidió que esta acción cotidiana debe convertirse en archivado reversible. Esa decisión ya no afecta solo al listado: también cambia la selección de audiencias, trabajos pendientes, flows activos, inbound, creación/importación, API pública, métricas, inbox y pipelines. Implementar el archivado únicamente en la página dejaría invariantes contradictorias en el resto del sistema.

## Solution

Convertir `/contacts` en una ruta server-first de Next.js 16. La URL será la fuente de verdad para búsqueda, etiquetas, estado y paginación. Un módulo profundo devolverá la vista completa del listado y ocultará la estrategia SQL, el enriquecimiento, el conteo y la paginación. La ruta renderizará datos en el servidor y reservará Client Components pequeños para búsqueda con debounce, filtros, selección, acciones optimistas y diálogos.

Sustituir el borrado cotidiano por archivado reversible mediante `archived_at`. El archivado será una operación transaccional de dominio que conserva el historial, cancela trabajo pendiente con un estado terminal explícito y bloquea nueva comunicación saliente. La restauración vuelve a habilitar trabajo futuro, pero nunca reactiva operaciones canceladas.

Aplicar las invariantes de archivado desde el primer release en dashboard, inbound, outbound, Contact import, Broadcast CSV, API pública, métricas, inbox y pipelines. Mantener incremental la migración de UI: los grandes flujos secundarios siguen siendo islas cliente, aunque sus módulos de dominio deben respetar el nuevo ciclo de vida.

## User Stories

1. Como usuario del CRM, quiero compartir una URL de contactos filtrada, para que otra persona vea la misma búsqueda, etiquetas, estado y página.
2. Como usuario del CRM, quiero que back/forward restaure filtros y páginas significativos, para navegar sin perder contexto.
3. Como usuario del CRM, quiero buscar contactos por nombre, teléfono o email, para encontrarlos por sus datos de identidad habituales.
4. Como usuario del CRM, quiero que la búsqueda no consulte el servidor por cada tecla, para obtener una experiencia rápida y estable.
5. Como usuario del CRM, quiero filtrar por varias etiquetas con semántica OR, para ver contactos que tengan al menos una de ellas.
6. Como usuario del CRM, quiero que las etiquetas estén separadas de la búsqueda textual, para entender por qué aparece cada resultado.
7. Como usuario del CRM, quiero alternar claramente entre contactos Active y Archived, para no mezclar acciones de ciclos de vida distintos.
8. Como usuario del CRM, quiero ver un skeleton durante cada cambio de consulta, para reconocer que se están cargando resultados nuevos.
9. Como usuario del CRM, quiero ver páginas numeradas de 25 contactos, para conservar el modelo de navegación conocido.
10. Como usuario del CRM, quiero que cambiar búsqueda, etiquetas o estado vuelva a la primera página, para no aterrizar en una página inválida o vacía.
11. Como usuario del CRM, quiero que “seleccionar todo” afecte solo a la página visible, para evitar acciones masivas inesperadas.
12. Como agente, quiero archivar un contacto sin destruir conversaciones ni mensajes, para conservar la historia de la relación.
13. Como agente, quiero archivar varios contactos seleccionados de la página, para organizar el directorio de forma segura.
14. Como agente, quiero que las filas se archiven inmediatamente de forma optimista, para recibir feedback sin esperar un refresco completo.
15. Como agente, quiero deshacer un archivado desde un toast, para recuperarme rápidamente de una acción accidental.
16. Como agente, quiero restaurar contactos desde la vista Archived, para devolverlos al trabajo activo.
17. Como agente, quiero restaurar varios contactos seleccionados de la página archivada, para recuperarlos de forma eficiente.
18. Como viewer, quiero consultar contactos activos y archivados sin poder modificarlos, para mantener acceso de solo lectura.
19. Como owner o admin, quiero que los agentes puedan archivar y restaurar, para no centralizar operaciones cotidianas en administradores.
20. Como usuario, quiero que un Archived contact sea solo lectura, para evitar cambios que disparen automatizaciones mientras no es elegible para comunicación.
21. Como usuario de inbox, quiero seguir viendo conversaciones de contactos archivados con un indicador claro, para conservar acceso al historial.
22. Como usuario de inbox, quiero que el compositor quede bloqueado para un contacto archivado, para no enviar mensajes que contradigan su estado.
23. Como usuario de inbox, quiero poder restaurar el contacto desde su conversación, para volver a comunicarme de forma explícita.
24. Como usuario de pipelines, quiero seguir viendo negocios asociados a contactos archivados, para no perder contexto comercial histórico.
25. Como usuario de pipelines, quiero identificar que el contacto de un negocio está archivado, para comprender por qué no puedo comunicarme con él.
26. Como operador de broadcasts, quiero que contactos archivados queden fuera de nuevas audiencias, para no enviarles campañas.
27. Como operador de broadcasts, quiero que un Broadcast CSV reporte contactos archivados excluidos, para entender la diferencia entre filas cargadas y destinatarios elegibles.
28. Como operador de broadcasts, quiero que un Broadcast CSV nunca restaure contactos, para que seleccionar una audiencia no cambie el ciclo de vida del directorio.
29. Como usuario de Contact import, quiero que un teléfono archivado restaure el contacto existente, para conservar una sola identidad y su historial.
30. Como usuario de Contact import, quiero fusionar valores no vacíos y añadir etiquetas al restaurar, para actualizar datos sin borrar información existente.
31. Como integrador de la API pública, quiero que crear un teléfono archivado restaure la identidad existente, para evitar duplicados.
32. Como integrador de la API pública, quiero que el `DELETE` cotidiano archive en lugar de purgar, para obtener el mismo comportamiento que el dashboard.
33. Como integrador de la API pública, quiero listar activos o archivados de forma explícita, para controlar qué ciclo de vida consumo.
34. Como integrador de la API pública, quiero una operación explícita de restauración, para reactivar contactos de forma intencional.
35. Como contacto archivado que vuelve a escribir, quiero que mi identidad se restaure antes de procesar el inbound, para continuar la conversación y el historial existentes.
36. Como operador de automatizaciones, quiero que archivar cancele trabajo pendiente con una causa auditable, para no confundir cancelaciones deliberadas con fallos.
37. Como operador de flows, quiero que un flow activo termine como cancelled al archivar, para no reanudar semanas después un estado conversacional obsoleto.
38. Como operador, quiero que restaurar no reactive trabajos cancelados, para evitar envíos tardíos y fuera de contexto.
39. Como responsable de cumplimiento, quiero que el último seam antes de enviar a Meta compruebe que el contacto sigue activo, para cubrir carreras entre selección y envío.
40. Como responsable de métricas, quiero que los conteos operativos excluyan archivados, para reflejar contactos actualmente utilizables.
41. Como responsable de métricas, quiero que las métricas históricas de creación conserven archivados, para no reescribir el pasado al cambiar el estado actual.
42. Como usuario, quiero que un fallo de lectura se muestre como error reintentable y no como lista vacía, para distinguir indisponibilidad de ausencia de datos.
43. Como usuario, quiero que una mutación fallida revierta la UI optimista y muestre un error, para no creer que se confirmó un cambio rechazado.
44. Como desarrollador, quiero una interfaz única para cargar la vista del listado, para no coordinar joins, conteos y estrategias de consulta desde la ruta.
45. Como desarrollador, quiero una interfaz única para resolver identidad de contacto, para concentrar deduplicación, restauración, merge y carreras de unicidad.
46. Como desarrollador, quiero probar RPC y RLS contra Supabase local, para verificar comportamiento real sin depender únicamente de mocks.

## Implementation Decisions

### Estado de navegación

- La URL es la fuente de verdad del estado persistente del listado.
- `q` representa Contact search parcial por nombre, teléfono o email. No busca nombres de etiquetas.
- Cada etiqueta seleccionada se representa mediante un parámetro repetido `tag` cuyo valor es un UUID estable.
- Varias etiquetas usan semántica OR: basta con que el contacto tenga una etiqueta seleccionada.
- `page` representa paginación numerada de 25 elementos.
- El modo predeterminado es Active; Archived se representa mediante un estado explícito en la URL.
- El parser de consulta valida tipos, descarta valores inválidos, elimina IDs duplicados y produce una representación canónica.
- Cambiar búsqueda, etiquetas o estado reinicia la página a 1.
- La búsqueda mantiene un borrador cliente y actualiza `q` después de 350 ms sin escritura.
- La búsqueda usa navegación replace; etiquetas, pestañas de estado y paginación usan push.

### Arquitectura Next.js y React

- La página de ruta será un Server Component y consumirá `searchParams` asíncronos según el contrato de Next.js 16.
- La ruta no realizará fetching inicial mediante efectos cliente.
- La lectura permanecerá sin caché persistente y será fresca en cada navegación y después de cada mutación.
- No se introducen realtime ni TTL de caché.
- Una frontera Suspense identificada por la consulta normalizada mostrará el skeleton completo durante cada cambio de búsqueda, filtro, estado o página.
- La ruta dispondrá de un loading state para la entrada inicial y un error boundary reintentable para fallos de lectura.
- La interactividad se divide en islas cliente pequeñas: búsqueda/filtros, acciones de header y tabla/selección.
- Los grandes diálogos existentes se cargarán de forma diferida cuando se abran.
- La tabla usa `useOptimistic` para proyectar archive/restore y `useTransition` para representar la mutación pendiente.
- Los fallos de mutación revierten la proyección optimista y muestran un toast.
- No se usa `useDeferredValue` como sustituto de debounce de red.
- No se introduce `useActionState` en acciones que no son formularios y no necesitan estado de validación de formulario.

### Módulo profundo de lectura

- La ruta consume una única operación `getContactListView`.
- La interfaz devuelve items serializables, opciones de etiquetas y datos completos de paginación.
- El caller no conoce joins, conteos, RLS, RPC, enriquecimiento de etiquetas ni bifurcaciones por filtro.
- Una RPC `list_contacts` unifica las estrategias actuales de PostgREST y filtro por etiquetas.
- La RPC aplica Contact search, Tag filter OR, estado Active/Archived, orden, offset, límite, total exacto y enriquecimiento de etiquetas.
- La RPC usa `SECURITY INVOKER`; las políticas RLS del caller continúan delimitando la cuenta.
- Las opciones globales de etiquetas pueden cargarse en paralelo dentro del módulo profundo.
- La estrategia offset/count se oculta detrás de la interfaz para permitir una migración futura a cursor sin volver a diseñar la ruta.

### Ciclo de vida del contacto

- Se añade `archived_at` nullable; `NULL` significa Active y un timestamp significa Archived.
- Un Archived contact es de solo lectura y se excluye del listado Active y de nueva comunicación saliente.
- El listado Archived permite búsqueda, filtro por etiquetas, paginación, selección page-scoped y restauración.
- Archive y restore requieren rol `agent` o superior; viewer conserva lectura.
- El borrado irreversible no forma parte de las operaciones cotidianas.
- Archive individual y masivo se ejecutan inmediatamente y ofrecen Undo mediante restore.
- Restore no requiere confirmación y no reactiva trabajo previamente cancelado.

### Operación transaccional de archivado

- El archivado multi-tabla se implementa como una función Postgres transaccional autorizada.
- La función usa `SECURITY DEFINER`, valida identidad y membresía `agent+` dentro de la función, limita contactos a la cuenta autorizada, revoca acceso público y concede ejecución únicamente al rol autenticado correspondiente.
- La Server Action valida input, invoca la función y refresca la ruta; no coordina escrituras service-role secuenciales.
- El archivado actualiza el contacto y cancela atómicamente trabajo relacionado todavía pendiente.
- Broadcast recipients y automation pending executions incorporan un estado terminal `cancelled`.
- Flow runs activos terminan como `cancelled` al archivar.
- La cancelación registra fecha y causa `contact_archived`.
- Estados ya iniciados, enviados, entregados, terminados o fallidos no se reescriben.
- Restore nunca devuelve trabajo `cancelled` a pending ni reanuda flows cancelados.

### Comunicación saliente

- Consultas de audiencias, pickers y resolución de destinatarios excluyen Archived contacts.
- El archivado cancela destinatarios y ejecuciones pendientes para cerrar el trabajo ya materializado.
- Cada adapter que realiza un envío externo comprueba inmediatamente antes del envío que el contacto continúa Active.
- El guard devuelve un error tipado `contact_archived` para que cada caller registre una cancelación o fallo de elegibilidad coherente.
- Esta defensa en profundidad protege carreras entre la construcción de audiencia y el envío.

### Identidad, creación e inbound

- Dentro de una cuenta, el teléfono normalizado identifica una única Contact identity a través de archive/restore.
- Un módulo profundo común resuelve los resultados `created`, `existing` y `restored`.
- El módulo concentra normalización, deduplicación, recuperación de carreras de unicidad, restauración, merge y unión de etiquetas.
- Crear o usar Contact import con un teléfono Archived restaura el contacto existente.
- La restauración por creación o Contact import fusiona valores no vacíos; valores vacíos no borran datos existentes.
- Las etiquetas entrantes se añaden a las existentes en lugar de reemplazarlas.
- El webhook inbound restaura la identidad antes de crear/resolver la conversación y procesar el mensaje.
- La rama que recupera una carrera de unicidad debe aplicar la misma restauración.
- Broadcast CSV puede crear identidades nuevas según el comportamiento actual, pero excluye identidades Archived y nunca las restaura.

### Inbox, pipelines y métricas

- Las conversaciones de Archived contacts permanecen visibles con indicador Archived.
- El compositor y otras acciones salientes quedan bloqueados hasta restaurar.
- Los negocios permanecen visibles y conservan su estado; muestran que el contacto está archivado.
- Archivar un contacto no archiva ni cierra automáticamente sus negocios.
- Totales operativos, audiencias y pickers activos excluyen Archived contacts.
- Métricas históricas basadas en creación conservan contactos posteriormente archivados.

### API pública

- El ciclo de vida es consistente entre dashboard y API pública.
- El `DELETE` cotidiano pasa a significar archive, no purge.
- Las listas pueden distinguir explícitamente Active y Archived y usan Active por defecto.
- Crear un teléfono Archived restaura y fusiona mediante el mismo módulo de identidad.
- Existe una operación explícita de restore.
- El cambio de comportamiento debe documentarse en la documentación pública y changelog.
- No se incorpora un endpoint de purge irreversible.

### Alcance incremental de UI

- Formulario, detalle, importación y gestor de campos personalizados conservan inicialmente su arquitectura cliente.
- Estos flujos adoptan las invariantes de dominio necesarias, pero no se migran integralmente a Server Actions en esta iniciativa.
- La reorganización visual se concentra en la ruta, toolbar, tabla, paginación, estados de carga/error y acciones archive/restore.

## Testing Decisions

### Principios

- Probar comportamiento observable a través del seam más alto que pueda demostrar la invariante.
- No probar que una función interna específica fue llamada si el resultado de dominio puede observarse desde la RPC, el módulo o la UI.
- Evitar mocks para propiedades que dependen de Postgres: transacción, RLS, constraints, estados y visibilidad por cuenta.
- Mantener la suite de base de datos mínima: uno o dos archivos enfocados en las invariantes de mayor riesgo.

### Supabase local / pgTAP

- Probar que un agent puede archivar y restaurar contactos de su cuenta.
- Probar que viewer no puede archivar ni restaurar.
- Probar que un usuario no puede afectar contactos de otra cuenta.
- Probar que archive establece `archived_at` y cancela atómicamente trabajo pending y flow runs activos.
- Probar que trabajo iniciado o terminado no cambia.
- Probar que cancellation usa el estado terminal y la causa acordados.
- Probar que restore limpia `archived_at` sin reactivar trabajos cancelados.
- Probar que un fallo en cualquier parte de archive revierte toda la operación.
- Probar que `list_contacts` respeta RLS, Active/Archived, Contact search, Tag filter OR, paginación y total.
- Ejecutar las pruebas únicamente contra Supabase local, dentro de transacciones que terminan en rollback.

### Vitest: módulos de dominio y adapters

- Probar canonicalización de búsqueda, UUIDs repetidos, página y estado.
- Probar eliminación de parámetros inválidos y duplicados.
- Probar la política de historial: replace para búsqueda y push para filtros/página/estado.
- Probar resultados `created`, `existing` y `restored` del módulo de identidad.
- Probar merge de valores no vacíos, unión de etiquetas y recuperación de carreras de unicidad.
- Probar que Contact import puede restaurar y Broadcast CSV excluye Archived contacts.
- Probar que el guard de salida devuelve `contact_archived` y evita invocar el adapter externo.
- Probar validación de IDs y traducción de errores en Server Actions.
- Reutilizar como prior art los tests existentes de deduplicación, resolución de conversación, escritura/eventos de tags, status de broadcasts, engines de automatización/flows y Route Handlers.

### Vitest: comportamiento React

- Probar debounce de búsqueda y sincronización con URL.
- Probar selección limitada a las filas de la página visible.
- Probar archive/restore optimista y limpieza de selección.
- Probar rollback y toast cuando la Server Action falla.
- Probar Undo como restore de los IDs archivados.
- Probar diferencias de acciones entre las pestañas Active y Archived.
- Probar que viewer no recibe controles de mutación habilitados.
- No introducir Playwright como parte de esta iniciativa.

## Out of Scope

- Migración completa de Contact form a Server Actions.
- Migración completa de Contact detail, Contact import o custom fields a Server Components/Actions.
- Borrado irreversible o UI administrativa de purge.
- Cursor/keyset pagination.
- Búsqueda full-text, fuzzy search, ranking o nuevos índices de relevancia.
- Incluir tags dentro de `q`.
- Selección de todos los resultados filtrados más allá de la página visible.
- Realtime mediante suscripciones Supabase.
- Caché persistente, TTL o Cache Components.
- Reactivación de broadcasts, automatizaciones o flows cancelados.
- Cierre o archivado automático de negocios.
- Ocultación del historial de inbox.
- Introducción de Playwright o una suite E2E completa.
- Dividir esta especificación en tickets o iniciar implementación antes de planificar los bloqueos.

## Further Notes

- Next.js instalado: 16.2.6. React instalado: 19.2.4.
- La guía local de Next.js confirma `searchParams` asíncronos, Server Components por defecto, límites cliente pequeños, datos sin caché por defecto y Suspense para streaming de lecturas dinámicas.
- Cache Components no está habilitado; esta propuesta no depende de esa opción.
- Supabase CLI 2.109.1 está disponible y el repositorio ya contiene configuración y migraciones locales.
- GitHub Issues será el tracker de publicación de esta especificación en `Andeveling/wacrm`.
- El repositorio ya contiene el glosario de dominio actualizado y un ADR que registra la decisión de archivar en lugar de borrar.

### Puntos solicitados al revisor técnico

1. Confirmar que el alcance transversal de archive/restore es implementable como una secuencia segura de tracer bullets sin liberar estados intermedios incoherentes.
2. Revisar la seguridad de la función `SECURITY DEFINER`: autorización, aislamiento por cuenta, search path, grants y comportamiento bajo RLS.
3. Revisar la migración de estados `cancelled` y su impacto en métricas, triggers y máquinas de estado existentes.
4. Revisar carreras entre archive, inbound, selección de audiencia y envío externo.
5. Revisar el cambio de semántica de `DELETE` en la API pública y determinar si necesita transición o versionado.
6. Confirmar que `list_contacts` puede devolver filas enriquecidas y total exacto con un plan razonable para el volumen esperado.
7. Confirmar si las invariantes de Contact import y Broadcast CSV pueden concentrarse en un único módulo de identidad sin volver su interfaz excesivamente configurable.
8. Confirmar que uno o dos archivos pgTAP son suficientes para cubrir las garantías SQL/RLS críticas.
