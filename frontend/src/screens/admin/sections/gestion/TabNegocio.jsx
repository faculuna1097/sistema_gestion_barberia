// /frontend/src/screens/admin/sections/gestion/TabNegocio.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../../services/api';

export default function TabNegocio() {
  const [nombreNegocio, setNombreNegocio]     = useState('');
  const [nombreOriginal, setNombreOriginal]   = useState('');
  const [bookingUrl, setBookingUrl]           = useState('');
  const [bookingUrlOriginal, setBookingUrlOriginal] = useState('');
  const [cargando, setCargando]               = useState(true);
  const [guardando, setGuardando]             = useState(false);
  const [error, setError]                     = useState(null);
  const [exito, setExito]                     = useState(false);

  useEffect(() => {
    const cargarNegocio = async () => {
      console.log('[tabNegocio] cargarNegocio — request recibido');
      try {
        const res  = await apiFetch('/admin/negocio');
        const data = await res.json();
        console.log('[tabNegocio] cargarNegocio — completado | nombre:', data.nombre_negocio);
        setNombreNegocio(data.nombre_negocio);
        setNombreOriginal(data.nombre_negocio);
        setBookingUrl(data.booking_url || '');
        setBookingUrlOriginal(data.booking_url || '');
      } catch (err) {
        console.error('[tabNegocio] Error en cargarNegocio:', err.message);
        setError('No se pudieron cargar los datos del negocio.');
      } finally {
        setCargando(false);
      }
    };
    cargarNegocio();
  }, []);

  const huboCambios  = nombreNegocio.trim() !== nombreOriginal
                    || bookingUrl.trim() !== bookingUrlOriginal;
  const puedeGuardar = nombreNegocio.trim() !== '' && huboCambios;

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    setExito(false);

    console.log('[tabNegocio] handleGuardar — request recibido | nombre:', nombreNegocio.trim());

    try {
      const res = await apiFetch('/admin/negocio', {
        method: 'PUT',
        body: JSON.stringify({
          nombre_negocio: nombreNegocio.trim(),
          booking_url: bookingUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error del servidor');
      }

      const data = await res.json();
      console.log('[tabNegocio] handleGuardar — completado | nombre:', data.nombre_negocio);
      setNombreOriginal(data.nombre_negocio);
      setBookingUrlOriginal(data.booking_url || '');
      setExito(true);
      setTimeout(() => setExito(false), 3000);
    } catch (err) {
      console.error('[tabNegocio] Error en handleGuardar:', err.message);
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
        <p style={styles.cardHint}>Nombre oficial del negocio registrado en el sistema.</p>

        <div style={styles.campoGrupo}>
          <label style={styles.campoLabel}>Nombre</label>
          <input
            type="text"
            value={nombreNegocio}
            onChange={e => { setNombreNegocio(e.target.value); setExito(false); }}
            placeholder="Ej: Kingsai Studio"
            style={styles.campoInput}
          />
        </div>

        <div style={styles.separador} />

        <p style={styles.cardTitulo}>Plataforma de reserva de turnos</p>
        <p style={styles.cardHint}>
          URL de la plataforma de turnos (Setmore, Booksy, Fresha, etc.).
          Si se configura, aparece un botón de acceso rápido en la pantalla principal.
        </p>

        <div style={styles.campoGrupo}>
          <label style={styles.campoLabel}>URL de turnos</label>
          <input
            type="url"
            value={bookingUrl}
            onChange={e => { setBookingUrl(e.target.value); setExito(false); }}
            placeholder="Ej: https://setmore.com/kingsaistudio"
            style={styles.campoInput}
          />
        </div>

        {error && <p style={styles.errorTextoInline}>{error}</p>}

        {exito && (
          <p style={styles.exitoTexto}>✓ Datos actualizados correctamente.</p>
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

const styles = {
  contenedor: {
    maxWidth: '580px',
    margin: '0 auto',
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
  separador: {
    height: '1px',
    backgroundColor: '#eeeeee',
    margin: '4px 0',
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