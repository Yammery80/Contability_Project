import { useState } from "react";
import { getAuth, updatePassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../hooks/useAuth";
import { initials } from "../../services/period";

interface PanelUserProps {
  isForced: boolean;
  onSuccessChange: () => void;
}

export default function PanelUser({ isForced, onSuccessChange }: PanelUserProps) {
    const { profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  
  const db = getFirestore();

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMensaje("");

   if (newPassword !== confirmPassword) {
      return setError("Las nuevas contraseñas no coinciden.");
    }

    if (newPassword.length < 8) {
      return setError("La contraseña debe tener al menos 8 caracteres.");
    }

    setBusy(true);
    const auth = getAuth();
    const user = auth.currentUser;

   if (user && user.email) {
      try {
        await signInWithEmailAndPassword(auth, user.email, currentPassword);
        // Como el usuario acaba de iniciar sesión con su contraseña temporal,
        // la sesión es reciente y podemos actualizar la contraseña directamente.
        await updatePassword(user, newPassword);

        // Si es un acceso forzado, desactivamos el bloqueo en Firestore
        if (isForced) {
          await updateDoc(doc(db, "users", user.uid), {
            mustChangePassword: false
          });
          if (onSuccessChange) onSuccessChange(); // Desbloquea la PWA al instante
        } else {
          setMensaje("¡Contraseña actualizada con éxito!");
          setNewPassword("");
          setConfirmPassword("");
        }

      } catch (err: any) {
        console.error(err);
        setError("Error al actualizar la contraseña. Por favor, vuelve a iniciar sesión e inténtalo de nuevo.");
      } finally {
        setBusy(false);
      }
    }
  };

if (!isForced) {
    return (
      <div className="module-page" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h1>Mi Perfil</h1>
        <p className="page-subtitle">Información general de tu cuenta y configuración de seguridad</p>

        {/* Tarjeta con los datos del usuario */}
        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div className="avatar" style={{ width: '70px', height: '70px', fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff', borderRadius: '50%', fontWeight: 'bold' }}>
              {profile ? initials(profile.name) : 'U'}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{profile?.name || 'Usuario'}</h2>
              <p className="muted" style={{ margin: '4px 0 0 0' }}>{profile?.position || 'Sin puesto asignado'}</p>
            </div>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #e2e8f0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
            <div>
              <span className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>Correo electrónico</span>
              <strong>{profile?.email || '—'}</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>Teléfono</span>
              <strong>{profile?.phone || '—'}</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>Rol en el sistema</span>
              <strong>{profile?.role || '—'}</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>Estado</span>
              <span className={'pill ' + (profile?.active ? 'ok' : 'off')}>
                {profile?.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>

        {/* Sección independiente para cambiar contraseña de forma voluntaria */}
        <div className="card" style={{ padding: '2rem', marginTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.2rem' }}>Seguridad y Contraseña</h3>
          <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.2rem' }}>
            Si deseas actualizar tu contraseña actual por motivos de seguridad, ingresa los datos a continuación.
          </p>

          <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label className="form-field">
              <span>Contraseña actual</span>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                placeholder="Ingresa tu contraseña actual"
                required 
              />
            </label>

            <label className="form-field">
              <span>Nueva contraseña (mínimo 8 caracteres)</span>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Nueva contraseña"
                required 
              />
            </label>

            <label className="form-field">
              <span>Confirmar nueva contraseña</span>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Repite la nueva contraseña"
                required 
              />
            </label>

            {error && <div className="alert alert-error">{error}</div>}
            {mensaje && <div className="alert alert-success">{mensaje}</div>}

            <div style={{ marginTop: '0.5rem' }}>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="card user-form">
      <h3>Cambiar contraseña obligatoria</h3>
      <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
        <label className="form-field">
          <span>Contraseña actual (temporal asignada)</span>
          <input 
            type="password" 
            value={currentPassword} 
            onChange={(e) => setCurrentPassword(e.target.value)} 
            required 
          />
        </label>
        
        <label className="form-field">
          <span>Nueva contraseña</span>
          <input 
            type="password" 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            required 
          />
        </label>

        <label className="form-field">
          <span>Confirmar nueva contraseña</span>
          <input 
            type="password" 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
            required 
          />
        </label>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && <div className="alert alert-success">{mensaje}</div>}

        <button className="btn" type="submit">Guardar y desbloquear sistema</button>
      </form>
    </div>
  );
}