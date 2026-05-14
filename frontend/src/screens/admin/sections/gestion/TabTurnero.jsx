// /frontend/src/screens/admin/sections/gestion/TabTurnero.jsx
// Configuración del turnero: duración de slots.
// Lee y actualiza duracion_slot_minutos del tenant vía PUT /api/admin/turnero/config.

import { useState, useEffect } from 'react';
import { getAdminTurneroConfig, putAdminTurneroConfig } from '../../../../services/api';

export default function TabTurnero() {
  const [duracion, setDuracion]     = useState('');
  const [original, setOriginal]     = useState('');
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);
  const [mensaje, setMensaje]       = useState(null);
  const [error, setError]           = useState(null);

  useEffect(() => {
    async function cargar() {
      console.log('[tabTurnero] cargar — request recibido');
      try {
        const data = await getAdminTurneroConfig();
        const valor = String(data.duracion_slot_minutos);
        setDuracion(valor);
        setOriginal(valor);
        console.log('[tabTurnero] cargar — completado | duracion_slot_minutos:', data.duracion_slot_minutos);
      } catch (err) {
        console.error('[tabTurnero] Error cargando config:', err.message);
        setError('No se pudo cargar la configuración del turnero.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  /**
   * guardar — envía la nueva duración al backend.
   */
  const guardar = async () => {
    const valor = Number(duracion);
    if (!Number.isInteger(valor) || valor < 1 || valor > 240) {
      setMensaje('La duración debe ser un número entero entre 1 y 240 minutos.');
      return;
    }

    setGuardando(true);
    setMensaje(null);
    try {
      const data = await putAdminTurneroConfig({ duracion_slot_minutos: valor });
      const nuevoValor = String(data.duracion_slot_minutos);
      setDuracion(nuevoValor);
      setOriginal(nuevoValor);
      setMensaje('Configuración guardada correctamente.');
      console.log('[tabTurnero] guardar — completado | duracion_slot_minutos:', data.duracion_slot_minutos);
    } catch (err) {
      console.error('[tabTurnero] Error guardando:', err.message);
      setMensaje('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const hayCambios = duracion !== original;
  const valorValido = duracion !== '' && Number.isInteger(Number(duracion)) && Number(duracion) >= 1 && Number(duracion) <= 240;

  if (cargando) return <p style={styles.estadoTexto}>Cargando configuración...</p>;
  if (error)    return <p style={styles.errorTexto}>{error}</p>;

  return (
    <div>
      <div style={styles.card}>
        <p style={styles.cardTitulo}>Duración de slots</p>
        <p style={styles.cardDescripcion}>
          Define la unidad mínima de tiempo del turnero. Cada servicio ocupa uno o más slots.
          Por ejemplo, con slots de 30 minutos, un servicio de 1 slot dura 30 min y uno de 2 slots dura 60 min.
        </p>

        <div style={styles.campoRow}>
          <div style={styles.campoGrupo}>
            <label style={styles.campoLabel}>Minutos por slot</label>
            <div style={styles.inputRow}>
              <input
                type="number"
                min="1"
                max="240"
                value={duracion}
                onChange={(e) => { setDuracion(e.target.value); setMensaje(null); }}
                style={{
                  ...styles.campoInput,
                  borderColor: duracion !== '' && !valorValido ? '#c0392b' : '#e0e0e0',
                }}
              />
              <span style={styles.sufijo}>min</span>
            </div>
            {duracion !== '' && !valorValido && (
              <p style={styles.campoError}>Debe ser un número entero entre 1 y 240.</p>
            )}
          </div>
        </div>

        {mensaje && (
          <p style={{
            ...styles.mensaje,
            color: mensaje.startsWith('Error') ? '#c0392b' : '#2e7d32',
          }}>
            {mensaje}
          </p>
        )}

        <button
          onPointerDown={guardar}
          disabled={!hayCambios || !valorValido || guardando}
          style={{
            ...styles.btnGuardar,
            ...(!hayCambios || !valorValido || guardando ? styles.btnDeshabilitado : {}),
          }}
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

const styles = {
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
  card: {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1.5px solid #eeeeee',
    maxWidth: '480px',
  },
  cardTitulo: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111111',
    margin: '0 0 8px',
  },
  cardDescripcion: {
    fontSize: '13px',
    color: '#888888',
    margin: '0 0 20px',
    lineHeight: '1.5',
  },
  campoRow: {
    marginBottom: '16px',
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
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  campoInput: {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    fontSize: '15px',
    color: '#111111',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
    width: '120px',
  },
  sufijo: {
    fontSize: '15px',
    color: '#888888',
    fontWeight: '500',
  },
  campoError: {
    fontSize: '12px',
    color: '#c0392b',
    margin: 0,
  },
  mensaje: {
    fontSize: '13px',
    margin: '0 0 12px',
  },
  btnGuardar: {
    padding: '10px 24px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  btnDeshabilitado: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
  },
};
