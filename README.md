# Plataforma de Gestión — Contable / Fiscal (MVP)

Stack: React + TypeScript + Vite + Firebase (Authentication + Firestore).

## 1. Configuración inicial

```bash
npm install
cp .env.example .env
# Completa .env con las credenciales web de tu proyecto Firebase "hercanutrivet"
# (Configuración del proyecto → General → Tus apps → SDK de Firebase)
npm run dev
```

## 2. Firebase

1. En la consola de Firebase, habilita **Authentication → Email/Password**.
2. Habilita **Cloud Firestore** (modo producción).
3. Despliega las reglas incluidas en `firestore.rules`:
   ```bash
   firebase deploy --only firestore:rules
   ```
4. Crea el **primer usuario SUPERUSER** manualmente (paso único, hasta tener
   panel de invitaciones):
   - Crea el usuario en Authentication (correo/contraseña).
   - Copia su UID.
   - En Firestore, crea un documento en la colección `users` con **ese mismo UID
     como ID del documento**, con los campos:
     ```json
     { "name": "Admin", "email": "admin@empresa.com", "role": "SUPERUSER", "active": true, "createdAt": 0 }
     ```
   - A partir de ahí, puedes crear más usuarios desde `/admin/users`, pero
     recuerda que esa pantalla sólo guarda el **perfil** en Firestore: dar de
     alta el acceso en Authentication (para que puedan iniciar sesión) se hace
     aparte, hasta que se conecte una Cloud Function que lo automatice.

## 3. Estructura del proyecto

```
src/
├── components/      # AppLayout (sidebar/topbar), ProtectedRoute
├── pages/           # Login, ForgotPassword
├── hooks/           # useAuth (sesión + perfil + rol)
├── services/        # createFirestoreService: CRUD genérico reutilizable
├── models/          # Tipos de todas las colecciones
├── firebase/         # Inicialización de Firebase
└── modules/
    ├── users/        # CRUD de usuarios (sólo SUPERUSER)
    ├── clients/      # CRUD de clientes (persona física / moral)
    ├── projects/     # CRUD de proyectos
    ├── tasks/        # CRUD de tareas, vista "Mis tareas" para OPERATOR
    ├── timeTracker/   # Cronómetro persistido en Firestore + registro manual + resumen semanal (40h)
    ├── obligations/  # Obligaciones con semáforo visual (datos de ejemplo)
    ├── notifications/# Estructura base de notificaciones
    ├── dashboards/   # Dashboard adaptado por rol
    └── reports/      # Estructura de reportes (rentabilidad con datos mock)
```

## 4. Rutas y roles

Según el documento oficial de Historias de Usuario (HU-06), el sistema tiene
**4 roles** — no hay un rol "Cliente": el cliente del despacho nunca inicia
sesión, solo existe como registro en la colección `clients`.

| Rol (Firestore) | Nombre          | Ruta base | Acceso |
|------------------|-----------------|-----------|--------|
| `OPERATOR`       | Operador / Colaborador | `/operator` | Dashboard propio, sus tareas, time tracker, obligaciones asignadas, notificaciones |
| `SUPERVISOR`     | Supervisor      | `/supervisor` | Todo lo anterior + clientes, proyectos, tareas de equipo, reportes |
| `ADMIN`          | Administrador   | `/admin`  | Todo lo anterior + gestión de usuarios |
| `SUPERUSER`      | Superusuario    | `/admin`  | Mismo alcance que Administrador (acceso total al despacho) |

`SUPERUSER` y `ADMIN` comparten el mismo segmento de rutas (`/admin`) porque,
según el documento de roles, su alcance operativo es prácticamente idéntico
(ambos gestionan usuarios, clientes, proyectos, tareas, obligaciones y
reportes). Si más adelante necesitan diferenciar algún permiso fino entre
ambos (p. ej. configuración avanzada solo para Superusuario), se resuelve
dentro de cada página revisando `profile.role`, sin duplicar rutas.

`ProtectedRoute` valida sesión, que el usuario esté `active` en Firestore, y
que su rol tenga permiso sobre esa sección.

## 5. Time Tracker — punto importante del brief

- `startTime` se guarda en Firestore (no depende del estado de React), así
  que si el usuario cierra el navegador con el cronómetro corriendo, al volver
  a entrar el tiempo transcurrido se recalcula a partir de ese `startTime`.
- El resumen semanal (`Objetivo: 40 h / Registrado / Restante`) se calcula a
  partir de las entradas de la semana en curso (lunes a domingo).

## 6. Qué falta a propósito (según el brief)

No se implementó lógica real de: tipos exactos de declaraciones fiscales,
reglas fiscales, fechas fiscales automáticas, documentación requerida por
obligación, fórmulas definitivas de rentabilidad, ni integraciones con Koy o
LIA Memory. Los módulos de **Obligaciones** y **Reportes → Rentabilidad**
están preparados con datos ficticios para poder ajustarse fácilmente cuando
la empresa entregue esa información.
