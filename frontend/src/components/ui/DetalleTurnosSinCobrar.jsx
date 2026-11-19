// /frontend/src/components/ui/DetalleTurnosSinCobrar.jsx
// Detalle del aviso de turnos sin cobrar (F3 de plan_mejoras_operativas.md). Lo
// abren el aviso del iPad (MainScreen) y el del Inicio del panel. Es un Modal del
// tamaño de su contenido (el plan pedía pantalla completa; el usuario prefirió una
// card, porque el contenido es poco), con `botonCerrar`: foco, Tab encerrado, ESC,
// tocar afuera y la X de la esquina vienen de ahí.
//
// Una columna por barbero con sus horarios pendientes apilados (decidido con el
// usuario el 2026-11-18): se lee como "Alejo: 10:00 y 12:30" y sigue el orden del
// cobro de los de hoy, que en "Ingresar Corte" elige primero el barbero y después
// el turno. En la práctica son todos de hoy (el cierre nocturno cierra los de días
// anteriores); si queda uno de otro día, lleva la fecha arriba de la hora, y el
// texto del iPad dice que ese se cobra en el panel ("Ingresar Corte" lista solo
// los de hoy).
//
// Lo que cambia entre las dos superficies va por props:
//   - kiosko: los tamaños grandes del iPad (TAM_KIOSKO, §3.6).
//   - mostrarCliente: el nombre del cliente debajo de la hora. Hoy lo pasan las
//     dos superficies (el usuario lo quiso también en el iPad, 2026-11-18).
//   - onIrAlTurnero: el botón "Ir al Turnero", solo el panel. El iPad explica en
//     el texto dónde se resuelve cada turno.

import { theme, TAM_KIOSKO } from '../../theme/tokens.js';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import IconoAlerta from './IconoAlerta.jsx';
import { agruparPorBarbero, textoCantidadSinCobrar } from '../../utils/turnosSinCobrar.js';

// Texto de un turno sin cliente (F1): el mismo en todo el panel.
const SIN_DATOS = 'Sin datos';

// Ancho fijo de la columna de cada barbero: las columnas se centran como grupo
// (con 1 o 2 barberos no quedan pegadas a la izquierda) y pasan a otra fila si no
// entran (3 por fila en el ancho de la card).
const ANCHO_COLUMNA = { kiosko: 200, panel: 176 };

// Rótulo mono en mayúsculas (la fecha de un turno de otro día).
const estiloRotuloMono = {
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: theme.muted,
};

/**
 * HorarioPendiente
 * Un turno pendiente dentro de la columna de su barbero: la hora de inicio en
 * grande; arriba, la fecha si no es de hoy; abajo, el cliente si corresponde.
 * @param {Object} props
 * @param {{ hora: string, dia: string|null, cliente_nombre: string|null }} props.turno
 *   Turno ya agrupado (agruparPorBarbero).
 * @param {boolean} props.kiosko - Tamaños del iPad.
 * @param {boolean} props.mostrarCliente - Suma el nombre del cliente.
 * @returns {JSX.Element}
 */
function HorarioPendiente({ turno, kiosko, mostrarCliente }) {
  return (
    <li style={{
      padding: kiosko ? '12px 16px' : '8px 12px',
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      fontFamily: theme.body,
    }}>
      {turno.dia && (
        <div style={{
          ...estiloRotuloMono,
          fontSize: kiosko ? TAM_KIOSKO.etiquetaResumen : theme.sizeMicro,
          marginBottom: 2,
        }}>
          {turno.dia}
        </div>
      )}
      <div style={{
        fontSize: kiosko ? TAM_KIOSKO.montoTotal : theme.sizeTitle,
        fontWeight: theme.weightHeading,
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
        color: theme.ink,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {turno.hora}
      </div>
      {mostrarCliente && (
        <div style={{
          marginTop: 2,
          fontSize: kiosko ? TAM_KIOSKO.subtitulo : theme.sizeBody,
          color: turno.cliente_nombre ? theme.inkSoft : theme.muted,
          overflowWrap: 'anywhere',
        }}>
          {turno.cliente_nombre || SIN_DATOS}
        </div>
      )}
    </li>
  );
}

/**
 * ColumnaBarbero
 * La columna de un barbero: su nombre con la cantidad y sus horarios pendientes,
 * centrados. El nombre queda fijo arriba (sticky) mientras se scrollean sus
 * horarios; con columnas en dos filas, cada nombre queda fijo mientras su columna
 * está a la vista.
 * @param {Object} props
 * @param {{ barbero_id: string, barbero_nombre: string, turnos: Array }} props.grupo
 * @param {boolean} props.kiosko - Tamaños del iPad.
 * @param {boolean} props.mostrarCliente - Suma el cliente en cada horario.
 * @returns {JSX.Element}
 */
function ColumnaBarbero({ grupo, kiosko, mostrarCliente }) {
  const idTitulo = `sin-cobrar-${grupo.barbero_id}`;
  return (
    <section
      aria-labelledby={idTitulo}
      style={{ width: kiosko ? ANCHO_COLUMNA.kiosko : ANCHO_COLUMNA.panel, textAlign: 'center' }}
    >
      <h2
        id={idTitulo}
        style={{
          // Fijo arriba, pegado al borde de la zona que scrollea. El cuerpo del
          // Modal tiene 16 de padding arriba: con top 0 el nombre quedaba 16 más
          // abajo y los horarios se veían pasar por encima. top -16 lo sube al
          // borde, y el padding de 16 (compensado con el margin) tapa esa franja.
          position: 'sticky',
          top: -16,
          zIndex: 1,
          // Fondo de la card: los horarios pasan por debajo al scrollear.
          background: theme.surface,
          margin: '-16px 0 0',
          padding: '16px 0 8px',
          fontFamily: theme.body,
          fontSize: kiosko ? TAM_KIOSKO.opcion : theme.sizeHeading,
          fontWeight: theme.weightHeading,
          color: theme.ink,
          overflowWrap: 'anywhere',
        }}
      >
        {grupo.barbero_nombre}
        <span style={{ color: theme.muted, fontWeight: theme.weightRegular }}> · {grupo.turnos.length}</span>
      </h2>
      <ul style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {grupo.turnos.map((turno) => (
          <HorarioPendiente key={turno.id} turno={turno} kiosko={kiosko} mostrarCliente={mostrarCliente} />
        ))}
      </ul>
    </section>
  );
}

/**
 * AvisoCierre
 * Recuadro del modo alerta: a la noche los turnos pendientes se cierran solos. Va
 * en el encabezado del modal, debajo del subtítulo, así queda fijo como el título.
 * @param {Object} props
 * @param {boolean} props.kiosko - Tamaños del iPad.
 * @returns {JSX.Element}
 */
function AvisoCierre({ kiosko }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: kiosko ? '12px 16px' : '8px 12px',
      marginTop: 12,
      textAlign: 'left',
      background: theme.warningSoft,
      border: `1px solid ${theme.warning}`,
      borderRadius: theme.radius,
      fontFamily: theme.body,
      fontSize: kiosko ? TAM_KIOSKO.subtitulo : theme.sizeBody,
      color: theme.ink,
    }}>
      <span style={{ color: theme.warning, display: 'inline-flex', flexShrink: 0 }}>
        <IconoAlerta size={kiosko ? 24 : 20} />
      </span>
      Esta noche se cierran solos como «no asistió».
    </div>
  );
}

/**
 * textoQueHacer
 * El subtítulo del detalle: dónde se resuelve cada turno. En el iPad, "Ingresar
 * Corte" lista solo los turnos de hoy: si hay alguno de otro día, el texto lo
 * separa y manda ese al panel (S-B-01 de auditoria_2026-11.md).
 * @param {boolean} kiosko - Es el iPad.
 * @param {boolean} hayDeOtroDia - Algún turno no es de hoy.
 * @returns {string}
 */
function textoQueHacer(kiosko, hayDeOtroDia) {
  if (!kiosko) return 'Cobralos o marcalos como «no asistió» en Turnero.';
  return hayDeOtroDia
    ? 'Los de hoy se cobran con «Ingresar Corte». Los de otros días y el «no asistió», en el panel, en Turnero.'
    : 'Se cobran con «Ingresar Corte». El «no asistió» se marca en el panel, en Turnero.';
}

/**
 * DetalleTurnosSinCobrar
 * Modal con los turnos sin cobrar, una columna por barbero (por nombre) y sus
 * horarios por hora de inicio. Título, subtítulo (y el aviso del modo alerta) y
 * los nombres de los barberos quedan fijos; scrollean solo los horarios. Las
 * columnas van centradas y pasan a otra fila si no entran.
 * @param {Object} props
 * @param {boolean} props.open - Si está abierto.
 * @param {Function} props.onClose - Cierra el modal (X, ESC o tocar afuera).
 * @param {Array<{ id, barbero_id, barbero_nombre, inicio, fin, cliente_nombre }>} props.turnos
 * @param {boolean} props.enAlerta - Modo alerta: suma el aviso del cierre de la noche.
 * @param {boolean} [props.kiosko=false] - Tamaños del iPad.
 * @param {boolean} [props.mostrarCliente=false] - Muestra el cliente de cada turno.
 * @param {Function} [props.onIrAlTurnero] - Si viene, el pie lleva "Ir al Turnero":
 *   cierra el modal y llama a esta función.
 * @returns {JSX.Element|null}
 */
function DetalleTurnosSinCobrar({
  open,
  onClose,
  turnos,
  enAlerta,
  kiosko = false,
  mostrarCliente = false,
  onIrAlTurnero,
}) {
  const grupos = agruparPorBarbero(turnos);
  // agruparPorBarbero deja `dia` en null solo en los turnos de hoy.
  const hayDeOtroDia = grupos.some((grupo) => grupo.turnos.some((turno) => turno.dia));
  const queHacer = textoQueHacer(kiosko, hayDeOtroDia);

  return (
    <Modal
      open={open}
      onClose={onClose}
      botonCerrar
      etiquetaCerrar="Cerrar el detalle"
      maxWidth={kiosko ? 760 : 640}
      title={kiosko
        ? <span style={{ fontSize: TAM_KIOSKO.etiquetaTotal }}>{textoCantidadSinCobrar(turnos.length)}</span>
        : textoCantidadSinCobrar(turnos.length)}
      subtitle={
        <>
          {kiosko ? <span style={{ fontSize: TAM_KIOSKO.subtitulo }}>{queHacer}</span> : queHacer}
          {enAlerta && <AvisoCierre kiosko={kiosko} />}
        </>
      }
      footer={onIrAlTurnero && (
        <Button
          full={false}
          onClick={() => { onClose(); onIrAlTurnero(); }}
          style={{ marginLeft: 'auto' }}
        >
          Ir al Turnero
        </Button>
      )}
    >
      {/* Columnas de ancho fijo, centradas como grupo; desde el cuarto barbero
          pasan a otra fila. */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: kiosko ? 24 : 16,
      }}>
        {grupos.map((grupo) => (
          <ColumnaBarbero
            key={grupo.barbero_id}
            grupo={grupo}
            kiosko={kiosko}
            mostrarCliente={mostrarCliente}
          />
        ))}
      </div>
    </Modal>
  );
}

export default DetalleTurnosSinCobrar;
