// /frontend/src/screens/admin/sections/SeccionCaja.jsx
//
// Sección Caja del panel de administrador.
// - Tab "Movimientos del día": tabla de movimientos del día seleccionado +
//   totales netos por canal (efectivo / Mercado Pago). El "+" de la fila de
//   pestañas abre el alta de movimientos extra (retiro, aporte, otro ingreso).
// - Tabs "Cierre de caja" / "Historial de cierres": placeholders (v1.1).
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Densidad compacta.
// El fondo del contenedor lo da PanelAdmin (theme.surfaceAlt, D7 del plan).
// Loading via primitivo LoadingState (D6).

import { useState, useEffect } from 'react';
import { Banknote, Trash2, Inbox, Construction, RefreshCw, Info, Plus } from 'lucide-react';

import { apiFetch } from '../../../services/api';
import { getFechaHoy } from '../../../utils/fecha';
import { fmtPesos, formatPago } from '../../../utils/formato';
import {
  labelTipoMovimiento,
  OPCIONES_TIPO_MOVIMIENTO_EXTRA,
  MAX_DESCRIPCION_MOVIMIENTO,
} from '../../../utils/movimientos';
import { cargarChunk } from '../../../utils/cargarChunk';
import { errorDeRespuesta, mensajeDeError } from '../../../utils/errores';
import { toast } from '../../../utils/toast';
import { colorResultado } from '../../../utils/colorMonto';
import {
  Tabs,
  LoadingState,
  EmptyState,
  ConfirmDialog,
  Button,
  BotonIconoFila,
  DetalleRecurso,
  IconoAlerta,
  BadgeFormaPago,
  BotonExportarExcel,
  TogglePill,
  SelectorDia,
  Modal,
  Field,
  InputTiempo,
  GrupoOpciones,
  OPCIONES_FORMA_PAGO_TONO,
} from '../../../components/ui';
import { theme } from '../../../theme/tokens.js';

// ─── Sub-componentes locales ──────────────────────────────────────────────────

/**
 * TipoMovimientoPill
 * Pill compacto que indica el tipo de movimiento. El texto sale del catálogo
 * central (utils/movimientos.js); acá solo se decide el color. Aporte y retiro
 * van en neutro: el retiro se distingue por el monto (con "−" y en rojo). El
 * neutro es neutralSoft y no surfaceAlt, que es el hover de la fila.
 * Local a esta sección. Promover a primitivo cuando aparezca el segundo uso (§7.1).
 * @param {object} props
 * @param {'corte'|'venta'|'gasto'|'aporte_capital'|'retiro_socio'|'otro_ingreso'} props.tipo
 */
function TipoMovimientoPill({ tipo }) {
  const variantes = {
    corte:          { background: theme.successSoft, color: theme.success },
    venta:          { background: theme.accentSoft,  color: theme.accent  },
    gasto:          { background: theme.dangerSoft,  color: theme.danger  },
    aporte_capital: { background: theme.neutralSoft, color: theme.inkSoft },
    retiro_socio:   { background: theme.neutralSoft, color: theme.inkSoft },
    otro_ingreso:   { background: theme.successSoft, color: theme.success },
  };
  const v = variantes[tipo] ?? { background: theme.neutralSoft, color: theme.inkSoft };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: theme.radiusSm,
      fontFamily: theme.body,
      fontSize: theme.sizeMicro,
      fontWeight: theme.weightMedium,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      background: v.background,
      color: v.color,
    }}>{labelTipoMovimiento(tipo)}</span>
  );
}

/**
 * filasDetalleMovimiento
 * Arma el array de filas que se pasa al primitivo DetalleRecurso para mostrar
 * el detalle del movimiento dentro del ConfirmDialog de eliminación.
 * @param {object} m - Movimiento
 * @returns {Array}
 */
function filasDetalleMovimiento(m) {
  return [
    { label: 'Hora',    valor: m.hora },
    { label: 'Tipo',    valor: labelTipoMovimiento(m.tipo) },
    // overflowWrap: un detalle largo sin espacios corta dentro del diálogo.
    { label: 'Detalle', valor: <span style={{ overflowWrap: 'anywhere' }}>{m.detalle}</span> },
    ...(m.barbero_nombre ? [{ label: 'Barbero', valor: m.barbero_nombre }] : []),
    {
      label: 'Monto',
      valor: fmtPesos(m.monto),
      numeric: true,
      valorColor: m.sentido === 'salida' ? theme.danger : theme.ink,
      valorWeight: theme.weightHeading,
    },
  ];
}

/**
 * TablaMovimientos
 * Tabla densa de movimientos. Hover de fila vía :hover scoped con un <style>
 * inline (excepción consciente al patrón useState — ver deuda #8 del sistema
 * de diseño: para tablas densas con N filas, useState por fila explota el
 * render al mover el mouse).
 *
 * El signo y el color del monto salen de `m.sentido`, que llega resuelto desde
 * el backend. Las columnas cortas no parten línea; Detalle absorbe el ancho
 * restante y corta dentro de la celda aunque el texto no tenga espacios.
 *
 * @param {object} props
 * @param {Array} props.movimientos
 * @param {(m: object) => void} props.onEliminar
 */
function TablaMovimientos({ movimientos, onEliminar }) {
  const columnas = ['Hora', 'Tipo', 'Barbero', 'Detalle', 'Monto', 'Forma de pago', ''];

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columnas.map((col, i) => (
              <th key={i} style={{
                padding: '10px 12px',
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                fontWeight: theme.weightHeading,
                color: theme.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: `1px solid ${theme.hairline}`,
                textAlign: col === 'Monto' ? 'right' : 'left',
                whiteSpace: 'nowrap',
                width: col === '' ? 48 : undefined,
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m, i) => {
            const esSalida = m.sentido === 'salida';
            const tdBase = {
              padding: '10px 12px',
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.ink,
              borderBottom: i === movimientos.length - 1 ? 'none' : `1px solid ${theme.hairlineSoft}`,
              verticalAlign: 'middle',
            };
            const tdFijo = { ...tdBase, whiteSpace: 'nowrap' };
            return (
              <tr key={m.id || i} className="om-fila-hover">
                <td style={tdFijo}>{m.hora}</td>
                <td style={tdFijo}><TipoMovimientoPill tipo={m.tipo} /></td>
                <td style={{ ...tdFijo, color: theme.muted }}>{m.barbero_nombre || '—'}</td>
                <td style={{ ...tdBase, overflowWrap: 'anywhere' }}>{m.detalle}</td>
                <td style={{
                  ...tdBase,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: theme.weightHeading,
                  color: esSalida ? theme.danger : theme.ink,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}>{esSalida ? '− ' : ''}{fmtPesos(m.monto)}</td>
                <td style={tdFijo}><BadgeFormaPago forma={m.forma_pago} /></td>
                <td style={{ ...tdBase, padding: '6px 8px', textAlign: 'center', width: 48 }}>
                  <BotonIconoFila
                    tono="danger"
                    icono={<Trash2 size={14} strokeWidth={1.75} />}
                    ariaLabel={`Eliminar movimiento de las ${m.hora}`}
                    onClick={() => onEliminar(m)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CardTotal
 * Card de resumen para los totales netos (efectivo / MP).
 * Local a esta sección.
 * @param {object} props
 * @param {ReactNode} props.icono - Ícono o logo a la izquierda
 * @param {string} props.label - Label corto (eyebrow mono uppercase)
 * @param {number|null} props.monto - Monto neto. Es un resultado: verde, rojo o
 *   negro en cero (colorResultado). `null` mientras el día carga o si falló:
 *   muestra "—" en vez de un número que no es del día elegido.
 */
function CardTotal({ icono, label, monto }) {
  const sinDato = monto === null;
  const colorMonto = sinDato ? theme.muted : colorResultado(monto);
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: 16,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radiusLg,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        flexShrink: 0,
        color: theme.muted,
      }}>{icono}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          fontWeight: theme.weightMedium,
          color: theme.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>{label}</span>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeTitle,
          fontWeight: theme.weightHeading,
          color: colorMonto,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>{sinDato ? '—' : fmtPesos(monto)}</span>
      </div>
    </div>
  );
}

/**
 * LogoMercadoPagoConFallback
 * Renderiza el logo de MP desde /public; si la carga falla, muestra un placeholder.
 */
function LogoMercadoPagoConFallback() {
  const [falloLogo, setFalloLogo] = useState(false);
  if (falloLogo) {
    return <Banknote size={28} strokeWidth={1.5} />;
  }
  return (
    <img
      src="/mercadopago.png"
      alt="Mercado Pago"
      style={{ height: 32, objectFit: 'contain' }}
      onError={() => setFalloLogo(true)}
    />
  );
}

// ─── Alta de movimientos extra ────────────────────────────────────────────────

/**
 * BotonNuevoMovimiento
 * "+" discreto que abre el alta de movimientos extra. Va a la derecha de las
 * pestañas, sin texto: no es una acción de uso cotidiano.
 * @param {object} props
 * @param {() => void} props.onClick
 */
function BotonNuevoMovimiento({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Registrar movimiento"
      title="Registrar movimiento"
      style={{
        alignSelf: 'center',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        background: 'transparent',
        border: `2px solid ${theme.accent}`,
        borderRadius: theme.radiusSm,
        color: hover ? theme.ink : theme.muted,
        cursor: 'pointer',
        transition: `color ${theme.transitionFast}`,
      }}
    >
      <Plus size={16} strokeWidth={1.75} />
    </button>
  );
}

/**
 * ModalNuevoMovimiento
 * Formulario de alta de un movimiento extra (retiro, aporte de capital u otro
 * ingreso). Es dueño de su estado: el padre lo monta al abrir y lo desmonta al
 * cerrar, así cada apertura arranca limpia.
 *
 * "Guardar" se habilita recién con todo elegido y válido. Un error del
 * servidor se muestra dentro del modal, que no se cierra.
 *
 * @param {object} props
 * @param {string} props.fechaInicial - Día con el que arranca el campo Fecha ('YYYY-MM-DD')
 * @param {Array<{id: string, nombre: string}>} props.socios - Dueños activos del tenant
 * @param {() => void} props.onCerrar - Cierra sin guardar
 * @param {(fecha: string) => void} props.onGuardado - Se llama tras un alta exitosa,
 *   con la fecha del movimiento guardado ('YYYY-MM-DD')
 */
function ModalNuevoMovimiento({ fechaInicial, socios, onCerrar, onGuardado }) {
  const [tipo, setTipo]                 = useState(null);
  const [socioId, setSocioId]           = useState(null);
  const [descripcion, setDescripcion]   = useState('');
  const [monto, setMonto]               = useState('');
  const [formaPago, setFormaPago]       = useState(null);
  const [fecha, setFecha]               = useState(fechaInicial);
  const [guardando, setGuardando]       = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);

  const hoy = getFechaHoy();
  const tipoElegido   = OPCIONES_TIPO_MOVIMIENTO_EXTRA.find((o) => o.value === tipo) ?? null;
  const requiereSocio = tipoElegido?.requiereSocio ?? false;
  // Con un solo dueño cargado, viene elegido sin que haya que tocarlo.
  const socioElegido  = socioId ?? (socios.length === 1 ? socios[0].id : null);
  const descripcionLimpia = descripcion.trim();
  const montoNumero   = Number(monto);

  const detalleValido = requiereSocio
    ? socioElegido !== null
    : descripcionLimpia.length >= 1 && descripcionLimpia.length <= MAX_DESCRIPCION_MOVIMIENTO;
  const montoValido = String(monto).trim() !== '' && Number.isFinite(montoNumero) && montoNumero > 0;
  // 'YYYY-MM-DD' ordena igual como texto que como fecha.
  const fechaValida = fecha !== '' && fecha <= hoy;
  const puedeGuardar = tipoElegido !== null && detalleValido && montoValido
    && formaPago !== null && fechaValida;

  /**
   * Envía el alta. Manda solo el campo que corresponde al tipo (socio_id o
   * descripcion). Si el servidor rechaza, deja el mensaje en el modal.
   */
  const guardar = async () => {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const res = await apiFetch('/caja/movimientos', {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          monto: montoNumero,
          forma_pago: formaPago,
          fecha,
          ...(requiereSocio ? { socio_id: socioElegido } : { descripcion: descripcionLimpia }),
        }),
      });
      if (!res.ok) throw await errorDeRespuesta(res);
      onGuardado(fecha);
    } catch (err) {
      console.error('[seccionCaja] Error en guardarMovimiento:', err.message);
      setErrorGuardar(mensajeDeError(err, 'No se pudo registrar el movimiento. Intentá de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCerrar}
      loading={guardando}
      title="Registrar movimiento"
      footer={
        <>
          <Button variant="secondary" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={!puedeGuardar || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GrupoOpciones
          label="Tipo"
          opciones={OPCIONES_TIPO_MOVIMIENTO_EXTRA}
          value={tipo}
          onChange={setTipo}
        />

        {tipoElegido && requiereSocio && (
          <GrupoOpciones
            label="Dueño"
            opciones={socios.map((s) => ({ value: s.id, label: s.nombre }))}
            value={socioElegido}
            onChange={setSocioId}
          />
        )}

        {tipoElegido && !requiereSocio && (
          <Field
            label="Descripción"
            value={descripcion}
            onChange={(v) => setDescripcion(v.slice(0, MAX_DESCRIPCION_MOVIMIENTO))}
            placeholder="Ej.: alquiler de sillón"
          />
        )}

        <Field
          label="Monto"
          type="number"
          value={monto}
          onChange={setMonto}
        />

        <GrupoOpciones
          label="Forma de pago"
          opciones={OPCIONES_FORMA_PAGO_TONO}
          value={formaPago}
          onChange={setFormaPago}
        />

        <InputTiempo
          type="date"
          label="Fecha"
          value={fecha}
          onChange={setFecha}
          max={hoy}
          full
        />

        {errorGuardar && (
          <div role="alert" style={{
            padding: '10px 12px',
            borderRadius: theme.radius,
            background: theme.dangerSoft,
            color: theme.danger,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            textAlign: 'center',
          }}>{errorGuardar}</div>
        )}
      </div>
    </Modal>
  );
}

// ─── Tab Movimientos del día ──────────────────────────────────────────────────

/**
 * TabMovimientos
 * Movimientos del día elegido: totales netos por canal, tabla con borrado por
 * fila, filtro "Solo Barberos", export a Excel y alta de movimientos extra.
 * El modal de alta se monta fuera del contenido, así puede abrirse aunque el
 * día esté cargando, vacío o haya fallado la carga.
 *
 * @param {object} props
 * @param {boolean} props.modalAbierto - Si el modal de alta está abierto (lo maneja SeccionCaja)
 * @param {() => void} props.onCerrarModal - Cierra el modal de alta
 */
function TabMovimientos({ modalAbierto, onCerrarModal }) {
  const [fecha, setFecha]                              = useState(getFechaHoy);
  const [movimientos, setMovimientos]                  = useState([]);
  const [cargando, setCargando]                        = useState(true);
  const [error, setError]                              = useState(null);
  const [intento, setIntento]                          = useState(0);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState(null);
  const [eliminando, setEliminando]                   = useState(false);
  const [soloNegocio, setSoloNegocio]                 = useState(false);
  const [socios, setSocios]                           = useState([]);

  // Carga one-shot de socios (los dueños del formulario de alta). Si falla
  // queda como array vacío: el modal no ofrece dueños, pero la sección no se rompe.
  useEffect(() => {
    let cancelado = false;
    const cargarSocios = async () => {
      try {
        const res = await apiFetch('/admin/socios');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelado) setSocios(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[seccionCaja] Error en cargarSocios:', err.message);
      }
    };
    cargarSocios();
    return () => { cancelado = true; };
  }, []);

  // Carga de movimientos. `intento` re-dispara el efecto al hacer "Reintentar"
  // y tras un alta en el día que se está viendo.
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res  = await apiFetch(`/caja/movimientos-dia?fecha=${fecha}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelado) setMovimientos(data.movimientos || []);
      } catch (err) {
        console.error('[seccionCaja] Error en cargarMovimientos:', err.message);
        if (!cancelado) setError('No se pudieron cargar los movimientos.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [fecha, intento]);

  // Filtro "Solo Barberos": excluye los cortes de barberos con 100% de comisión.
  // En la práctica esos cortes van directo al bolsillo del barbero y no pasan
  // por la caja del local — sacarlos da la visión "cuenta del local puro".
  const movimientosFiltrados = soloNegocio
    ? movimientos.filter(m => m.tipo !== 'corte' || Number(m.comision_valor) < 100)
    : movimientos;

  // Totales netos por canal: las salidas restan, las entradas suman.
  const calcularNeto = (forma) => movimientosFiltrados.reduce((acc, m) => {
    if (m.forma_pago !== forma) return acc;
    return m.sentido === 'salida' ? acc - Number(m.monto) : acc + Number(m.monto);
  }, 0);
  const efectivoNeto    = calcularNeto('efectivo');
  const mercadoPagoNeto = calcularNeto('mercado_pago');

  const confirmarEliminar = async () => {
    const { tipo, id } = movimientoAEliminar;
    setEliminando(true);
    try {
      const res = await apiFetch(`/caja/movimientos/${tipo}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw await errorDeRespuesta(res);
      setMovimientos(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('[seccionCaja] Error en confirmarEliminar:', err.message);
      // El diálogo se cierra igual; el aviso dice que el movimiento sigue ahí.
      toast.error(mensajeDeError(err, 'No se pudo eliminar el movimiento. Intentá de nuevo.'));
    } finally {
      setEliminando(false);
      setMovimientoAEliminar(null);
    }
  };

  /**
   * Tras un alta: cierra el modal y muestra el día del movimiento guardado.
   * Si es el día en pantalla recarga la lista; si es otro, Caja salta a ese día
   * (el cambio de `fecha` dispara la carga).
   * @param {string} fechaGuardada - 'YYYY-MM-DD'
   */
  const alGuardarMovimiento = (fechaGuardada) => {
    onCerrarModal();
    if (fechaGuardada === fecha) setIntento(n => n + 1);
    else setFecha(fechaGuardada);
  };

  const exportarExcel = async () => {
    // El chunk de xlsx se baja recién acá (lazy, #3). Si la descarga falla,
    // cargarChunk avisa con un toast y devuelve null, en vez de un unhandled
    // rejection silencioso.
    const XLSX = await cargarChunk(() => import('xlsx'), 'xlsx');
    if (!XLSX) return;
    const datos = movimientos.map(m => ({
      Hora:            m.hora,
      Tipo:            labelTipoMovimiento(m.tipo),
      Barbero:         m.barbero_nombre || '-',
      Detalle:         m.detalle,
      Monto:           m.sentido === 'salida' ? -Number(m.monto) : Number(m.monto),
      'Forma de pago': formatPago(m.forma_pago),
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos del dia');
    XLSX.writeFile(wb, `movimientos-${fecha}.xlsx`);
  };

  // Al eliminar un corte vinculado a un turno, el backend revierte ese turno a
  // 'reservado' (ver controllers/caja.js → eliminarMovimiento). Avisamos en el
  // cartel con una nota, solo cuando corresponde (corte con turno_id no nulo).
  const turnoVuelveAReservado =
    movimientoAEliminar?.tipo === 'corte' && !!movimientoAEliminar?.turno_id;

  // Mientras el día carga o si falló, `movimientos` todavía es el del día
  // anterior: los totales muestran "—" y el Excel queda deshabilitado. El
  // selector de día sigue a la vista para poder cambiar de día.
  const hayDatosDelDia = !cargando && !error;

  return (
    <>
      {modalAbierto && (
        <ModalNuevoMovimiento
          fechaInicial={fecha}
          socios={socios}
          onCerrar={onCerrarModal}
          onGuardado={alGuardarMovimiento}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ConfirmDialog
          open={!!movimientoAEliminar}
          title="¿Eliminar este registro?"
          message="Esta acción no se puede deshacer."
          confirmLabel="Sí, eliminar"
          loading={eliminando}
          onConfirm={confirmarEliminar}
          onCancel={() => setMovimientoAEliminar(null)}
        >
          {movimientoAEliminar && <DetalleRecurso filas={filasDetalleMovimiento(movimientoAEliminar)} />}
          {turnoVuelveAReservado && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 12,
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.muted,
            }}>
              <Info size={14} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                El turno asociado volverá a estado{' '}
                <strong style={{ color: theme.ink }}>Reservado</strong>.
              </span>
            </div>
          )}
        </ConfirmDialog>

        <div style={{ display: 'flex', gap: 12 }}>
          <CardTotal
            icono={<Banknote size={28} strokeWidth={1.5} />}
            label="Efectivo neto"
            monto={hayDatosDelDia ? efectivoNeto : null}
          />
          <CardTotal
            icono={<LogoMercadoPagoConFallback />}
            label="Mercado Pago neto"
            monto={hayDatosDelDia ? mercadoPagoNeto : null}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16 }}>
          <TogglePill
            activo={soloNegocio}
            onToggle={() => setSoloNegocio(v => !v)}
            labelOn="Solo Barberos"
          />
          <div style={{ justifySelf: 'center' }}>
            <SelectorDia value={fecha} onChange={setFecha} />
          </div>
          <BotonExportarExcel onClick={exportarExcel} disabled={!hayDatosDelDia || movimientos.length === 0} />
        </div>


        {cargando ? (
          <LoadingState />
        ) : error ? (
          <EmptyState
            tone="danger"
            glyph={<IconoAlerta />}
            title="No se pudo cargar"
            body={error}
            action={
              <Button variant="secondary" full={false} onClick={() => setIntento(n => n + 1)}>
                <RefreshCw size={16} strokeWidth={1.75} />
                Reintentar
              </Button>
            }
          />
        ) : movimientosFiltrados.length === 0 ? (
          <EmptyState
            glyph={<Inbox size={28} strokeWidth={1.5} />}
            title="Sin movimientos"
            body="No hay movimientos registrados en este día."
          />
        ) : (
          <TablaMovimientos
            movimientos={movimientosFiltrados}
            onEliminar={setMovimientoAEliminar}
          />
        )}
      </div>
    </>
  );
}

// ─── Tabs placeholder (v1.1) ──────────────────────────────────────────────────

function TabCierre() {
  return (
    <EmptyState
      glyph={<Construction size={28} strokeWidth={1.5} />}
      title="Cierre de caja"
      body="Próximamente. Estamos trabajando en esta vista."
    />
  );
}

function TabHistorial() {
  return (
    <EmptyState
      glyph={<Construction size={28} strokeWidth={1.5} />}
      title="Historial de cierres"
      body="Próximamente. Estamos trabajando en esta vista."
    />
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'movimientos', label: 'Movimientos del día' },
  { key: 'cierre',      label: 'Cierre de caja' },
  { key: 'historial',   label: 'Historial de cierres' },
];

/**
 * SeccionCaja
 * Raíz de la sección: pestañas + contenido de la pestaña activa. Guarda si el
 * modal de alta de movimientos está abierto, porque el "+" que lo abre vive en
 * la fila de las pestañas; el modal lo renderiza TabMovimientos, que conoce el
 * día elegido y recarga la lista.
 */
export default function SeccionCaja() {
  const [tabActivo, setTabActivo]       = useState('movimientos');
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* La línea inferior la dibuja este contenedor (y no el tablist) para que
          corra también debajo del "+", que queda fuera del role="tablist". */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        borderBottom: `1px solid ${theme.hairline}`,
      }}>
        <Tabs items={TABS} value={tabActivo} onChange={setTabActivo} style={{ borderBottom: 'none' }} />
        {tabActivo === 'movimientos' && (
          <BotonNuevoMovimiento onClick={() => setModalAbierto(true)} />
        )}
      </div>

      {tabActivo === 'movimientos' && (
        <TabMovimientos
          modalAbierto={modalAbierto}
          onCerrarModal={() => setModalAbierto(false)}
        />
      )}
      {tabActivo === 'cierre'      && <TabCierre />}
      {tabActivo === 'historial'   && <TabHistorial />}
    </div>
  );
}
