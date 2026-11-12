
const admin = require("./functions/node_modules/firebase-admin");

// Conexion exclusiva al emulador local.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({
  projectId: "demo-contability-test",
});

async function main() {
  const db = admin.firestore();

  const userId = "usuario-prueba-notificaciones";
  const taskId = "tarea-prueba-notificaciones";

  // Crear usuario de prueba.
  await db.collection("users").doc(userId).set({
    name: "Usuario de prueba",
    active: true,
    role: "OPERATOR",
  });

  // Crear tarea asignada al usuario.
  await db.collection("tasks").doc(taskId).set({
    title: "Prueba de notificaciones",
    projectId: "proyecto-prueba",
    assignedUserId: userId,
    assignedBy: "administrador-prueba",
    status: "PENDING",
    priority: "MEDIUM",
    dueDate: "2026-11-10",
    createdAt: Date.now(),
  });

  console.log("Usuario de prueba creado.");
  console.log("Tarea de prueba creada.");
  console.log("Esperando la notificacion...");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
