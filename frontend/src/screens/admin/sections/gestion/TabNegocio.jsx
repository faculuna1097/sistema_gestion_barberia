// frontend/src/screens/admin/sections/gestion/TabNegocio.jsx
// Permite ver y editar el nombre del negocio (tabla tenant).
// Los datos se cargan al montar el componente.

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TabNegocio() {
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [nombreOriginal, setNombreOriginal] = useState('');
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState(null);
  const [exito, setExito]         = useState(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[TabNegocio] Cargando datos del negocio...');
    fetch(`${API_URL}/api/gestion/negocio`)
      .then(r => r.json())
      .then(data => {
        console.log('[TabNegocio] Datos cargados:', data.nombre_negocio);
        setNombreNegocio(data.nombre_negocio);
        setNombreOriginal(data.nombre_negocio);
        setCargando(false);
      })
      .catch(err => {
        console.error('[TabNegocio] Error al cargar datos del negocio:', err);
        setError('No se pudieron cargar los datos del negocio.');
        setCargando(false);
      });
  }, []);

  const hubocambios  = nombreNegocio.trim() !== nombreOriginal;
  const puedeGuardar = nombreNegocio.trim() !== '' && hubocambios;

  /**
   * handleGuardar — envía PUT /api/gestion/negocio con el nuevo nombre.
   */
  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    setExito(false);

    console.log('[TabNegocio] Guardando nombre del negocio:', nombreNegocio.trim());

    try {
      const res = await fetch(`${API_URL}/api/gestion/negocio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_negocio: nombreNegocio.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const data = await res.json();
      console.log('[TabNegocio] Nombre actualizado:', data.nombre_negocio);
      setNombreOriginal(data.nombre_negocio);
      setExito(true);
      setTimeout(() => setExito(false), 3000);
    } catch (err) {
      console.error('[TabNegocio] Error al guardar:', err);
      setError(err.message || 'No se pudo guardar. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <p style={styles.estadoTexto}>Cargando datos del negocio...</p>;
  if (error && !nombreNegocio) return <p style={styles.errorTexto}>{error}</p>;

  return (
    <div style={styles.contenedor}>
      <div style={styles.card}>

        <p style={styles.cardTitulo}>Nombre del negocio</p>
        <p style={styles.cardHint}>
          Nombre oficial del negocio registrado en el sistema.
        </p>

        <div style={styles.campoGrupo}>
          <label style={styles.campoLabel}>Nombre</label>
          <input
            type="text"
            value={nombreNegocio}
            onChange={e => {
              setNombreNegocio(e.target.value);
              setExito(false);
            }}
            placeholder="Ej: Kingsai Studio"
            style={styles.campoInput}
          />
        </div>

        {error && <p style={styles.errorTextoInline}>{error}</p>}

        {exito && (
          <p style={styles.exitoTexto}>✓ Nombre actualizado correctamente.</p>
        )}

        <button
          style={{
            ...styles.btnGuardar,
            ...(!puedeGuardar || guardando ? styles.btnDeshabilitado : {}),
          }}
          onPointerDown={handleGuardar}
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>

      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    maxWidth: '780px',
  },
  card: {
    backgroundColor: '#fafafa',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardTitulo: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111111',
    margin: 0,
  },
  cardHint: {
    fontSize: '13px',
    color: '#aaaaaa',
    margin: 0,
  },
  campoGrupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  campoLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  campoInput: {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    fontSize: '15px',
    color: '#111111',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  btnGuardar: {
    padding: '13px 0',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
  estadoTexto: {
    textAlign: 'center',
    color: '#888888',
    fontSize: '15px',
    padding: '48px 0',
    margin: 0,
  },
  errorTexto: {
    textAlign: 'center',
    color: '#c0392b',
    fontSize: '15px',
    padding: '48px 0',
    margin: 0,
  },
  errorTextoInline: {
    color: '#c0392b',
    fontSize: '13px',
    margin: 0,
  },
  exitoTexto: {
    color: '#1a7a4a',
    fontSize: '14px',
    fontWeight: '600',
    margin: 0,
  },
};
