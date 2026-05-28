// /frontend/src/screens/admin/sections/gestion/TabTurnero.jsx
// Configuración del booking online del turnero. Hoy: única opción es la
// duración del slot en minutos (1-240). La estructura está preparada para
// sumar más cards de config (anticipación, días habilitados, etc.) en
// fases siguientes — cada una sería otra card stackeada en el mismo wrapper.
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Loading via
// LoadingState (D6). Feedback inline (sin modal): success / error en un
// banner discreto encima del botón Guardar.

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

import { getAdminTurneroConfig, putAdminTurneroConfig } from '../../../../services/api';
import {
  Button,
  Field,
  EmptyState,
  LoadingState,
  IconoAlerta,
} from '../../../../components/ui';
import { theme } from '../../../../theme/tokens.js';

// ─── Sub-componente local ─────────────────────────────────────────────────────

/**
 * MensajeFeedback
 * Banner inline para mostrar resultado de una operación de guardado. Variante
 * success / danger con su ícono Lucide correspondiente y bg / color tinted.
 * Local a esta sección por ahora — segundo caso del patrón podría disparar el
 * primitivo Toast (deuda #30 del plan).
 *
 * @param {object} props
 * @param {'success'|'danger'} props.tipo
 * @param {string} props.children - Texto del mensaje.
 */
function MensajeFeedback({ tipo, children }) {
  const cfg = tipo === 'success'
    ? { bg: theme.successSoft, color: theme.success, Icon: CheckCircle2 }
    : { bg: theme.dangerSoft,  color: theme.danger,  Icon: AlertTriangle };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      borderRadius: theme.radius,
      color: cfg.color,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
    }}>
      <cfg.Icon size={16} strokeWidth={1.75} />
      <span>{children}</span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * TabTurnero
 * Tab de configuración del booking online. Carga la config del tenant al
 * montar; guarda PUT solo cuando hay cambios y el valor es válido.
 *
 * @returns {JSX.Element}
 */
export default function TabTurnero() {
  const [duracion, setDuracion]   = useState('');
  const [original, setOriginal]   = useState('');
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento]     = useState(0);
  const [feedback, setFeedback]   = useState(null); // { tipo: 'success'|'danger', texto: string } | null
  const [errorCarga, setErrorCarga] = useState(null);

  // ── Carga inicial / reintentos ────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setErrorCarga(null);
      try {
        const data = await getAdminTurneroConfig();
        const valor = String(data.duracion_slot_minutos);
        if (!cancelado) {
          setDuracion(valor);
          setOriginal(valor);
        }
      } catch (err) {
        console.error('[tabTurnero] Error cargando config:', err.message);
        if (!cancelado) setErrorCarga('No se pudo cargar la configuración del turnero.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [intento]);

  // ── Validación derivada ───────────────────────────────────────────────────
  const valorNumero  = Number(duracion);
  const valorValido  = duracion !== '' && Number.isInteger(valorNumero) && valorNumero >= 1 && valorNumero <= 240;
  const hayCambios   = duracion !== original;
  const puedeGuardar = hayCambios && valorValido && !guardando;

  /**
   * guardar
   * Envía el PUT con la nueva duración. En éxito, sincroniza `original` con
   * el valor confirmado por el backend y muestra feedback success.
   */
  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setFeedback(null);
    try {
      const data = await putAdminTurneroConfig({ duracion_slot_minutos: valorNumero });
      const nuevoValor = String(data.duracion_slot_minutos);
      setDuracion(nuevoValor);
      setOriginal(nuevoValor);
      setFeedback({ tipo: 'success', texto: 'Configuración guardada correctamente.' });
    } catch (err) {
      console.error('[tabTurnero] Error guardando:', err.message);
      setFeedback({ tipo: 'danger', texto: err.message || 'No se pudo guardar la configuración.' });
    } finally {
      setGuardando(false);
    }
  };

  /**
   * onChangeDuracion
   * Filtra a solo dígitos (mismo patrón que Servicios/Productos para inputs
   * numéricos con type=text + inputMode=numeric) y limpia el feedback previo.
   */
  const onChangeDuracion = (v) => {
    setDuracion(v.replace(/\D/g, ''));
    setFeedback(null);
  };

  // ── Estados de carga / error ──────────────────────────────────────────────
  if (cargando) return <LoadingState />;
  if (errorCarga) {
    return (
      <EmptyState
        glyph={<IconoAlerta />}
        title="No se pudo cargar la configuración"
        body={errorCarga}
        action={
          <Button variant="secondary" onClick={() => setIntento((n) => n + 1)} full={false}>
            <RefreshCw size={16} strokeWidth={1.75} /> Reintentar
          </Button>
        }
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      maxWidth: 600,
    }}>

      <div style={{
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div>
          <div style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            color: theme.ink,
            letterSpacing: '-0.01em',
          }}>
            Duración de slots
          </div>
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            color: theme.muted,
            lineHeight: 1.5,
            marginTop: 6,
          }}>
            Define la unidad mínima de tiempo del turnero. Cada servicio ocupa uno o más slots — con slots de 30 min, un servicio de 1 slot dura 30 min y uno de 2 slots, 60 min.
          </div>
        </div>

        <Field
          label="Minutos por slot"
          type="text"
          inputMode="numeric"
          value={duracion}
          onChange={onChangeDuracion}
          placeholder="Ej: 30"
          helper="Entre 1 y 240."
          invalid={duracion !== '' && !valorValido}
        />

        {feedback && (
          <MensajeFeedback tipo={feedback.tipo}>{feedback.texto}</MensajeFeedback>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={guardar} disabled={!puedeGuardar} full={false}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

    </div>
  );
}
