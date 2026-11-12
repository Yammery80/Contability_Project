
import {getFirestore} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions";

interface TaskComment {
  id?: string;
  userId?: string;
  userName?: string;
  text?: string;
}

interface TaskData {
  title?: string;
  projectId?: string;
  assignedUserId?: string;
  assignedBy?: string;
  status?: string;
  completedBy?: string;
  comments?: TaskComment[];
}

interface UserData {
  active?: boolean;
}

interface ProjectData {
  supervisorId?: string;
}

interface Notification {
  userId: string;
  title: string;
  message: string;
  level: "INFO";
  read: boolean;
  createdAt: number;
}

/**
 * Crea una notificacion si el destinatario esta activo.
 * Utiliza un identificador fijo para evitar duplicados.
 * @param {string} id Identificador de la notificacion.
 * @param {string} userId Destinatario.
 * @param {string} title Titulo.
 * @param {string} message Mensaje.
 * @return {Promise<void>} Resultado.
 */
async function createNotification(
  id: string,
  userId: string,
  title: string,
  message: string
): Promise<void> {
  if (!userId) return;

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(userId).get();

  if (!userDoc.exists) return;

  const user = userDoc.data() as UserData;

  if (user.active !== true) return;

  const notification: Notification = {
    userId,
    title,
    message,
    level: "INFO",
    read: false,
    createdAt: Date.now(),
  };

  const notificationRef = db
    .collection("notifications")
    .doc(id);

  try {
    await notificationRef.create(notification);
  } catch (error) {
    const code = (error as {code?: number}).code;

    // La notificacion ya fue creada anteriormente.
    if (code === 6) return;

    throw error;
  }
}

/**
 * Detecta cambios en tareas y genera notificaciones.
 */
export const notifyTaskEvents = onDocumentWritten(
  {
    document: "tasks/{taskId}",
    region: "us-central1",
    retry: false,
  },
  async (event) => {
    const before = event.data?.before.data() as
      TaskData | undefined;

    const after = event.data?.after.data() as
      TaskData | undefined;

    if (!after) return;

    const taskId = event.params.taskId;
    const eventId = event.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const taskTitle = after.title || "Sin titulo";

    try {
      // 1. Creacion de una tarea.
      if (!before) {
        if (
          after.assignedUserId &&
          after.assignedUserId !== after.assignedBy
        ) {
          await createNotification(
            `task_created_${taskId}_${eventId}`,
            after.assignedUserId,
            "Nueva tarea asignada",
            `Se te asigno la tarea "${taskTitle}".`
          );
        }

        return;
      }

      // 2. Cambio de responsable.
      if (
        before.assignedUserId !== after.assignedUserId &&
        after.assignedUserId &&
        after.assignedUserId !== after.assignedBy
      ) {
        await createNotification(
          `task_assigned_${taskId}_${eventId}`,
          after.assignedUserId,
          "Tarea asignada",
          `Se te asigno la tarea "${taskTitle}".`
        );
      }

      // 3. Finalizacion de una tarea.
      if (
        before.status !== "COMPLETED" &&
        after.status === "COMPLETED" &&
        after.projectId
      ) {
        const projectDoc = await getFirestore()
          .collection("projects")
          .doc(after.projectId)
          .get();

        if (projectDoc.exists) {
          const project = projectDoc.data() as ProjectData;

          if (
            project.supervisorId &&
            project.supervisorId !== after.completedBy
          ) {
            await createNotification(
              `task_completed_${taskId}_${eventId}`,
              project.supervisorId,
              "Tarea completada",
              `La tarea "${taskTitle}" fue completada.`
            );
          }
        }
      }

      // 4. Nuevos comentarios.
      const previousIds = new Set(
        (before.comments ?? []).map((comment) => comment.id)
      );

      const newComments = (after.comments ?? []).filter(
        (comment) => comment.id &&
          !previousIds.has(comment.id)
      );

      for (const comment of newComments) {
        if (
          !after.assignedUserId ||
          after.assignedUserId === comment.userId
        ) {
          continue;
        }

        await createNotification(
          `task_comment_${taskId}_${comment.id}`,
          after.assignedUserId,
          "Nuevo comentario",
          `${comment.userName || "Un usuario"} comento en ` +
            `"${taskTitle}": ${(comment.text || "").slice(0, 120)}`
        );
      }

      logger.info("Eventos de tarea procesados", {
        taskId,
        eventId,
      });
    } catch (error) {
      logger.error("Error al procesar eventos de tarea", {
        taskId,
        eventId,
        error,
      });

      throw error;
    }
  }
);
