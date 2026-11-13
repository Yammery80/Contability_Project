const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

exports.createUserByAdmin = onCall(async (request) => {
  // Verificar que quien llama sea Administrador (puedes validar custom claims o roles en Firestore)
  const { email, password, role } = request.data;

  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });

    // Guardar su rol adicionalmente en Firestore
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email: email,
      role: role,
      mustChangePassword: true, // ¡Ligado a tu Sprint 1!
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    throw new Error(error.message);
  }
});