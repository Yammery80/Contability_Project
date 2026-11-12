
const admin = require("../functions/node_modules/firebase-admin");

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || "demo-hu29",
});

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const db = admin.firestore();

  const uniqueId = Date.now().toString();
  const userId = `usuario-prueba-${uniqueId}`;
  const taskId = `tarea-prueba-${uniqueId}`;

  await db.collection("users").doc(userId).set({
    name: "Usuario de prueba",
    active: true,
    role: "OPERATOR",
  });

  console.log("Usuario de prueba creado.");

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

  console.log("Tarea de prueba creada.");
  console.log("Esperando notificacion automatica...");

  const maxAttempts = 20;
  let notification = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const snapshot = await db
      .collection("notifications")
      .where("userId", "==", userId)
      .get();

    const matching = snapshot.docs.find((doc) =>
      doc.id.startsWith(`task_created_${taskId}_`)
    );

    if (matching) {
      notification = matching.data();
      break;
    }

    await sleep(1000);
  }

  if (!notification) {
    throw new Error(
      "No se genero la notificacion automatica."
    );
  }

  console.log("Notificacion encontrada:", notification);
  console.log("PRUEBA APROBADA: notificacion generada correctamente.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("PRUEBA FALLIDA:", error);
    process.exit(1);
  });
