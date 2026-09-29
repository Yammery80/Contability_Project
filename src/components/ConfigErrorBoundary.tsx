import React from 'react'

interface State { error: Error | null }

// Atrapa errores de arranque (típicamente: Firebase mal configurado) y
// muestra un mensaje legible en vez de dejar la pantalla en blanco.
export class ConfigErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Error de arranque de la aplicación:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#111827', color: 'white', fontFamily: 'system-ui, sans-serif', padding: '2rem',
        }}>
          <div style={{ maxWidth: 560, background: '#1f2937', padding: '2rem', borderRadius: 12 }}>
            <h1 style={{ marginTop: 0, fontSize: '1.2rem', color: '#f87171' }}>No se pudo iniciar la aplicación</h1>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{this.state.error.message}</p>
            <p style={{ color: '#9ca3af', fontSize: '.85rem' }}>Revisa también la consola del navegador (F12) para más detalle.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
