import React, { useEffect, useState } from 'react'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
// Puedes importar tu componente de perfil o la vista donde cambian la contraseña
import PanelUser from '../modules/panel_user/PanelUser' // o la ruta correspondiente

interface PasswordChangeGuardProps {
  children: React.ReactNode;
}

export default function PasswordChangeGuard({ children }: PasswordChangeGuardProps) {
  const [loading, setLoading] = useState(true);
  const [mustChange, setMustChange] = useState(false);
  
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const checkUserStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          setMustChange(userSnap.data().mustChangePassword === true);
        }
      }
      setLoading(false);
    };

    checkUserStatus();
  }, [auth.currentUser]);

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "50px" }}>Cargando aplicación...</div>;
  }

  // Si el usuario tiene el indicador en true, bloqueamos la PWA y le mostramos su panel para cambiar contraseña
  if (mustChange) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px" }}>
        <div className="alert alert-error" style={{ marginBottom: "20px" }}>
          ⚠️ <strong>Cambio de contraseña obligatorio:</strong> Por seguridad, debes actualizar tu contraseña temporal antes de utilizar el sistema.
        </div>
        <PanelUser 
          isForced={true} 
          onSuccessChange={() => setMustChange(false)} 
        />
      </div>
    );
  }

  return <>{children}</>;
}