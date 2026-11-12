
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions";

initializeApp();

const db = getFirestore();
const TIME_ZONE = "America/Mexico_City";

type AlertType = "PREVENTIVE" | "URGENT" | "OVERDUE";
type NotificationLevel = "WARNING" | "URGENT";
type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

interface TaskData {
  title?: string;
  projectId?: string;
  assignedUserId?: string;
  status?: TaskStatus;
  dueDate?: string;
}

interface ProjectData {
  supervisorId?: string;
}

interface UserData {
  active?: boolean;
  role?: string;
}

interface NotificationDetails {
  title: string;
  message: string;
  level: NotificationLevel;
}

/**
 * Obtiene la fecha actual en la zona horaria configurada.
 * @return {string} Fecha en formato YYYY-MM-DD.
 */
function localToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string): string =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Calcula los dias restantes hasta el vencimiento.
 * @param {string} dueDate Fecha de vencimiento.
 * @param {string} today Fecha actual.
 * @return {number|null} Dias restantes o null.
 */
function daysUntil(
  dueDate: string,
  today: string
): number | null {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!pattern.test(dueDate)) {
    return null;
  }

  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);

  if (!Number.isFinite(due) || !Number.isFinite(current)) {
    return null;
  }

  if (new Date(due).toISOString().slice(0, 10) !== dueDate) {
    return null;
  }

  return Math.round((due - current) / 86400000);
}

/**
 * Determina el tipo de alerta.
 * @param {number} days Dias restantes.
 * @return {AlertType|null} Tipo de alerta.
 */
function alertType(days: number): AlertType | null {
  if (days < 0) {
    return "OVERDUE";
  }

  if (days <= 3) {
    return "URGENT";
  }

  if (days <= 7) {
    return "PREVENTIVE";
  }

  return null;
}

/**
 * Genera el contenido de una notificacion.
 * @param {string} taskTitle Nombre de la tarea.
 * @param {number} days Dias restantes.
 * @param {AlertType} type Tipo de alerta.
 * @return {NotificationDetails} Contenido generado.
 */
function notificationDetails(
  taskTitle: string,
  days: number,
  type: AlertType
): NotificationDetails {
  if (type === "OVERDUE") {
    return {
      title: "Tarea vencida",
      message:
        `La tarea "${taskTitle}" tiene ` +
        `${Math.abs(days)} dia(s) de retraso.`,
      level: "URGENT",
    };
  }

  if (type === "URGENT") {
    return {
      title: "Vencimiento urgente",
      message:
        days === 0 ?
          `La tarea "${taskTitle}" vence hoy.` :
          `La tarea "${taskTitle}" vence en ${days} dia(s).`,
      level: "URGENT",
    };
  }

  return {
    title: "Proximo vencimiento",
    message:
      `La tarea "${taskTitle}" vence en ${days} dia(s).`,
    level: "WARNING",
  };
}

/**
 * Revisa tareas y genera notificaciones por vencimiento.
 * @return {Promise<void>} Resultado de la revision.
 */
export async function processTaskDeadlines(): Promise<void> {
  const today = localToday();

  const tasks = await db
    .collection("tasks")
    .where("status", "in", ["PENDING", "IN_PROGRESS"])
    .get();

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const taskDoc of tasks.docs) {
    try {
      const task = taskDoc.data() as TaskData;

      if (
        (task.status !== "PENDING" &&
          task.status !== "IN_PROGRESS") ||
        !task.dueDate ||
        typeof task.dueDate !== "string"
      ) {
        skipped++;
        continue;
      }

      const days = daysUntil(task.dueDate, today);

      if (days === null || alertType(days) === null) {
        skipped++;
        continue;
      }

      const recipients = new Set<string>();

      if (
        typeof task.assignedUserId === "string" &&
        task.assignedUserId.trim()
      ) {
        recipients.add(task.assignedUserId);
      }

      if (
        typeof task.projectId === "string" &&
        task.projectId.trim() &&
        days <= 3
      ) {
        const projectDoc = await db
          .collection("projects")
          .doc(task.projectId)
          .get();

        if (projectDoc.exists) {
          const project = projectDoc.data() as ProjectData;

          if (
            typeof project.supervisorId === "string" &&
            project.supervisorId.trim()
          ) {
            recipients.add(project.supervisorId);
          }
        }
      }

      for (const userId of recipients) {
        try {
          const result = await db.runTransaction(
            async (transaction) => {
              const currentDoc =
                await transaction.get(taskDoc.ref);

              const currentTask =
                currentDoc.data() as TaskData | undefined;

              if (!currentTask) {
                return false;
              }

              if (
                currentTask.status !== "PENDING" &&
                currentTask.status !== "IN_PROGRESS"
              ) {
                return false;
              }

              if (
                typeof currentTask.dueDate !== "string"
              ) {
                return false;
              }

              const currentDays = daysUntil(
                currentTask.dueDate,
                today
              );

              if (currentDays === null) {
                return false;
              }

              const currentType = alertType(currentDays);

              if (!currentType) {
                return false;
              }

              const isAssignee =
                currentTask.assignedUserId === userId;

              let isSupervisor = false;

              if (
                !isAssignee &&
                currentDays <= 3 &&
                currentTask.projectId
              ) {
                const projectRef = db
                  .collection("projects")
                  .doc(currentTask.projectId);

                const projectDoc =
                  await transaction.get(projectRef);

                if (projectDoc.exists) {
                  const project =
                    projectDoc.data() as ProjectData;

                  isSupervisor =
                    project.supervisorId === userId;
                }
              }

              if (!isAssignee && !isSupervisor) {
                return false;
              }

              const userRef = db
                .collection("users")
                .doc(userId);

              const userDoc =
                await transaction.get(userRef);

              if (!userDoc.exists) {
                return false;
              }

              const user =
                userDoc.data() as UserData;

              if (user.active !== true) {
                return false;
              }

              const notificationId = [
                "deadline",
                taskDoc.id,
                userId,
                currentTask.dueDate,
                currentType,
              ].join("_");

              const notificationRef = db
                .collection("notifications")
                .doc(notificationId);

              const existing =
                await transaction.get(notificationRef);

              if (existing.exists) {
                return false;
              }

              const details = notificationDetails(
                currentTask.title || "Sin titulo",
                currentDays,
                currentType
              );

              transaction.create(notificationRef, {
                userId,
                title: details.title,
                message: details.message,
                level: details.level,
                read: false,
                createdAt: Date.now(),
              });

              return true;
            }
          );

          if (result) {
            created++;
          }
        } catch (error) {
          errors++;

          logger.error(
            `Error al notificar tarea ${taskDoc.id}`,
            {userId, error}
          );
        }
      }
    } catch (error) {
      errors++;

      logger.error(
        `Error al revisar tarea ${taskDoc.id}`,
        error
      );
    }
  }

  logger.info("Revision de vencimientos finalizada", {
    date: today,
    tasksReviewed: tasks.size,
    notificationsCreated: created,
    tasksSkipped: skipped,
    errors,
  });

  if (errors > 0) {
    throw new Error(
      `La revision de vencimientos finalizo con ${errors} error(es).`
    );
  }
}

export const checkTaskDeadlines = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: TIME_ZONE,
    region: "us-central1",
    retryCount: 0,
  },
  processTaskDeadlines

);

export {notifyTaskEvents} from "./taskNotifications";
