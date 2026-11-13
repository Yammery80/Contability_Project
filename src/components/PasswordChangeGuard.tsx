import React, { useState } from 'react';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

interface PanelUserProps {
  isForced?: boolean;
  onSuccessChange?: () => void;
}

export default function PanelUser({ isForced = false, onSuccessChange }: PanelUserProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = getAuth();
  const db = getFirestore();

  // Evaluador de requisitos de seguridad de la contraseña
  const passwordCriteria = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    specialChar: /[@$!%*?&]/.test(newPassword),
  };

  const isPasswordSecure = Object.values(passwordCriteria).every(Boolean);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isPasswordSecure) {
      setError('La nueva contraseña no cumple con todos los requisitos de seguridad obligatorios.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las nuevas contraseñas no coinciden.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('La nueva contraseña debe ser diferente a la actual.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setError('No hay una sesión activa válida.');
      return;
    }

    setLoading(true);

    try {
      // 1. Reautenticar al usuario por seguridad antes de cambiar credenciales
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Actualizar la contraseña en Firebase Auth
      await updatePassword(user, newPassword);

      // 3. Si el cambio era forzado, desactivar el indicador en Firestore
      if (isForced) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { mustChangePassword: false });
      }

      setSuccess('¡Contraseña actualizada con éxito!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Notificar al guardián que ya puede dejar pasar al usuario
      if (onSuccessChange) {
        onSuccessChange();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('La contraseña actual es incorrecta.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil.');
      } else {
        setError('Ocurrió un error al actualizar la contraseña. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h2>Cambio de Contraseña</h2>
      {isForced && (
        <p style={{ color: '#d9534f', fontSize: '14px', marginBottom: '15px' }}>
          Por motivos de seguridad y políticas de la plataforma, debes cambiar tu contraseña temporal para continuar.
        </p>
      )}

      {error && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}
      {success && <div style={{ background: '#d4edda', color: '#155724', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{success}</div>}

      <form onSubmit={handlePasswordChange}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Contraseña Actual:</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Nueva Contraseña:</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          
          {/* Indicadores visuales de seguridad en tiempo real */}
          <div style={{ fontSize: '12px', marginTop: '8px', background: '#f9f9f9', padding: '10px', borderRadius: '4px' }}>
            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Requisitos de seguridad:</span>
            <div style={{ color: passwordCriteria.length ? 'green' : '#666' }}>✓ Mínimo 8 caracteres</div>
            <div style={{ color: passwordCriteria.uppercase ? 'green' : '#666' }}>✓ Al menos una letra mayúscula (A-Z)</div>
            <div style={{ color: passwordCriteria.lowercase ? 'green' : '#666' }}>✓ Al menos una letra minúscula (a-z)</div>
            <div style={{ color: passwordCriteria.number ? 'green' : '#666' }}>✓ Al menos un número (0-9)</div>
            <div style={{ color: passwordCriteria.specialChar ? 'green' : '#666' }}>✓ Al menos un carácter especial (@$!%*?&)</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Confirmar Nueva Contraseña:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !isPasswordSecure}
          style={{
            width: '100%',
            padding: '10px',
            background: isPasswordSecure ? '#007bff' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: isPasswordSecure ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
        </button>
      </form>
    </div>
  );
}