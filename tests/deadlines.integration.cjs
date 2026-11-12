
const assert = require("node:assert/strict");
const admin = require("../functions/node_modules/firebase-admin");

// Conexión exclusiva al emulador de Firestore.
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const firebaseProjectId =
  process.env.GCLOUD_PROJECT || "demo-hu29";

process.env.GCLOUD_PROJECT = firebaseProjectId;
process.env.GOOGLE_CLOUD_PROJECT = firebaseProjectId;

// La función importada inicializa Firebase Admin.
// No debemos ejecutar admin.initializeApp() otra vez.
const { processTaskDeadlines } =
  require("../functions/lib/index.js");

const db = admin.firestore();

// Obtiene la fecha actual de México.
function todayInMexico() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type).value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Suma o resta días a una fecha.
function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function main() {
  const unique = Date.now().toString();

  const userId = `deadline-user-${unique}`;
  const testProjectId = `deadline-project-${unique}`;
  const today = todayInMexico();

  // Crear usuario activo.
  await db.collection("users").doc(userId).set({
    name: "Usuario de prueba",
    active: true,
    role: "OPERATOR",
  });

  // Crear proyecto de prueba.
  await db.collection("projects").doc(testProjectId).set({
    name: "Proyecto de prueba",
  });

  // Casos de prueba.
  const cases = [
    {
      name: "Preventiva",
      days: 5,
      status: "PENDING",
      type: "PREVENTIVE",
      level: "WARNING",
    },
    {
      name: "Urgente",
      days: 2,
      status: "IN_PROGRESS",
      type: "URGENT",
      level: "URGENT",
    },
    {
      name: "Vencida",
      days: -1,
      status: "PENDING",
      type: "OVERDUE",
      level: "URGENT",
    },
    {
      name: "Fuera de rango",
      days: 10,
      status: "PENDING",
      type: null,
    },
    {
      name: "Completada",
      days: 1,
      status: "COMPLETED",
      type: null,
    },
  ];

  // Crear las tareas de prueba.
  for (const testCase of cases) {
    testCase.taskId =
      `deadline-task-${unique}-${testCase.days}`;

    testCase.dueDate = addDays(today, testCase.days);

    await db.collection("tasks")
      .doc(testCase.taskId)
      .set({
        title: testCase.name,
        projectId: testProjectId,
        assignedUserId: userId,
        assignedBy: userId,
        status: testCase.status,
        dueDate: testCase.dueDate,
        createdAt: Date.now(),
      });
  }

  console.log("Tareas de prueba creadas.");
  console.log("Ejecutando revision de vencimientos...");

  // Primera ejecución.
  await processTaskDeadlines();

  // Comprobar cada caso.
  for (const testCase of cases) {
    const notificationId = testCase.type
      ? [
          "deadline",
          testCase.taskId,
          userId,
          testCase.dueDate,
          testCase.type,
        ].join("_")
      : null;

    if (!notificationId) {
      const snapshot = await db
        .collection("notifications")
        .where("userId", "==", userId)
        .get();

      const related = snapshot.docs.filter((doc) =>
        doc.id.startsWith(
          `deadline_${testCase.taskId}_${userId}_`
        )
      );

      assert.equal(
        related.length,
        0,
        `${testCase.name} no deberia generar alertas`
      );
    } else {
      const doc = await db
        .collection("notifications")
        .doc(notificationId)
        .get();

      assert.ok(
        doc.exists,
        `Falta alerta: ${testCase.name}`
      );

      assert.equal(
        doc.data().level,
        testCase.level,
        `Nivel incorrecto: ${testCase.name}`
      );

      assert.equal(
        doc.data().userId,
        userId,
        `Destinatario incorrecto: ${testCase.name}`
      );
    }

    console.log(`OK: ${testCase.name}`);
  }

  // Verificar que no existan duplicados.
  const before = await db
    .collection("notifications")
    .where("userId", "==", userId)
    .get();

  console.log("Verificando que no existan duplicados...");

  // Segunda ejecución.
  await processTaskDeadlines();

  const after = await db
    .collection("notifications")
    .where("userId", "==", userId)
    .get();

  assert.equal(
    after.size,
    before.size,
    "La segunda ejecucion genero notificaciones duplicadas"
  );

  assert.equal(
    after.size,
    3,
    "Se esperaban exactamente tres alertas"
  );

  console.log("OK: Sin notificaciones duplicadas");
  console.log(
    "PRUEBA APROBADA: alertas de vencimiento correctas."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("PRUEBA FALLIDA:", error);
    process.exit(1);
  });
