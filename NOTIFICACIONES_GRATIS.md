# Notificaciones internas sin planes de pago

Se mantienen la campanita, contador y página original. El módulo registra:
- Tareas asignadas o reasignadas desde la aplicación.
- Comentarios y finalizaciones desde el detalle de tarea.
- Tareas y obligaciones asignadas a la sesión, a 7 días o menos y vencidas.

Las alertas por fechas se revisan al entrar a la aplicación y al volver a la pestaña. No son mensajes push ni correos: no se generan si nadie abre la aplicación. Un mismo vencimiento genera como máximo una notificación preventiva, una urgente y una vencida por usuario, fecha y entidad.

## Activación
1. Revisar `git diff` en una rama, no sobre `main`.
2. Probar con Firebase Emulator Suite (Auth + Firestore), especialmente reglas y roles.
3. Publicar **solo** las reglas Firestore cuando pasen las pruebas: `firebase deploy --only firestore:rules`. Esto modifica permisos; no desplegar sin autorización del equipo.
4. Publicar el frontend siguiendo el proceso del equipo. No desplegar functions antiguas: si ya están desplegadas, podrían producir avisos adicionales.

## Limitaciones
- El envío no es confiable si está offline: la app reintenta al volver a enfocarse.
- Los avisos de creación/asignación se generan desde los flujos de `TasksPage`/`TaskDetailPage`. Otros flujos que cambien datos directamente no disparan esos avisos.
- No hay envío push ni por correo.
- Costo $0 solo mientras se mantenga dentro de la cuota gratuita de Firestore.
- La versión básica no emite alertas globales de supervisor por obligaciones de terceros.
