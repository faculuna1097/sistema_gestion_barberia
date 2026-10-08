// /frontend-turnero/src/screens/SeleccionCuando.jsx
// Paso 2 del flujo, "¿Cuándo?": el cliente elige barbero ("Cualquiera" o uno
// del equipo), día y horario en la misma pantalla.
// Reemplaza a las pantallas separadas de barbero, fecha y horario.

import { useState } from 'react';
import { theme } from '../theme/tokens.js';
import { fmtPesos } from '../utils/formato.js';
import { fechaDeISO, DIAS_RESERVABLES } from '../utils/fecha.js';
import { useDisponibilidad } from '../hooks/useDisponibilidad.js';
import { useEleccionConPausa } from '../hooks/useEleccionConPausa.js';
import {
  PageContainer, TopBar, ScreenHeader, Progress, SelectorDiaHorario,
  AvatarIniciales, Skeleton, Button,
} from '../components/ui';

/**
 * SeleccionCuando
 * Barbero ("Cualquier barbero" en su renglón, arriba, y los barberos debajo)
 * + tira de días + horarios del día.
 * Al entrar y al cambiar de barbero se piden los días, se elige solo el
 * primer día con lugar (o el que ya estaba elegido, si sigue teniendo) y se
 * piden sus horarios. Tocar un horario, tras la pausa de la elección, avanza
 * con el barbero que atiende: el marcado o, con "Cualquiera", el que asigna
 * el backend para ese horario (`asignaciones`).
 * @param {Object} props.servicio - { id, nombre, duracion_minutos, precio }
 * @param {Object} props.barberos - Lista de App (useListaRemota): { datos, cargando, error, reintentar }
 * @param {Object|null} props.barberoInicial - Barbero marcado al entrar (null = "Cualquier barbero")
 * @param {string|null} props.horarioInicial - Horario ya elegido (ISO), al volver de Datos:
 *   se abre su día y queda marcado mientras no se cambie de barbero
 * @param {Function} props.onElegir - Recibe { horario, barbero, barberoAsignado };
 *   `barberoAsignado` es true si lo asignó "Cualquiera"
 * @param {Function} props.onVolver
 */
function SeleccionCuando({
  servicio, barberos, barberoInicial, horarioInicial, onElegir, onVolver,
}) {
  // Barbero marcado (null = "Cualquier barbero").
  const [barbero, setBarbero] = useState(barberoInicial);

  const agenda = useDisponibilidad({
    servicioId: servicio.id,
    barberoId: barbero?.id ?? null,
    fechaPreferida: horarioInicial ? fechaDeISO(horarioInicial) : null,
  });

  // El horario tocado se marca ~150 ms antes de avanzar. La elección completa
  // (horario + barbero) se arma al tocar, no al vencer la pausa: un cambio de
  // barbero en esos 150 ms no la altera.
  const [elegido, elegir] = useEleccionConPausa(onElegir);

  // El horario que traía la reserva se marca solo con el mismo barbero de la
  // entrada: con otro, ese horario no es el elegido.
  const mismoBarberoQueAlEntrar = (barbero?.id ?? null) === (barberoInicial?.id ?? null);
  const horarioMarcado = elegido?.horario ?? (mismoBarberoQueAlEntrar ? horarioInicial : null);

  /**
   * elegirHorario
   * Arma la elección del horario tocado y la pasa por la pausa.
   * Con "Cualquiera", el barbero sale de `asignaciones[iso]` buscado en la
   * lista de App. Si no está (la lista falló o se sumó un barbero después de
   * cargarla), va solo el id: la reserva funciona igual, sin el nombre.
   * @param {string} iso - Horario tocado
   */
  const elegirHorario = (iso) => {
    if (barbero) {
      elegir({ horario: iso, barbero, barberoAsignado: false });
      return;
    }
    const id = agenda.asignaciones[iso];
    const asignado = barberos.datos.find((b) => b.id === id) ?? { id, nombre: null };
    elegir({ horario: iso, barbero: asignado, barberoAsignado: true });
  };

  const textoSinDias = barbero
    ? `${barbero.nombre} no tiene turnos libres en los próximos ${DIAS_RESERVABLES} días.`
    : `No hay turnos libres en los próximos ${DIAS_RESERVABLES} días. Volvé a mirar en unos días.`;

  return (
    <PageContainer>
      <TopBar onVolver={onVolver}/>
      <Progress paso={2}/>
      <ScreenHeader
        title="¿Cuándo te queda?"
        subtitle={`${servicio.nombre} · ${servicio.duracion_minutos} min · ${fmtPesos(servicio.precio)}`}
      />

      <div style={{
        flex: 1,
        padding: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        <SelectorBarbero
          barberos={barberos}
          elegido={barbero}
          onElegir={setBarbero}
        />

        <SelectorDiaHorario
          dias={agenda.dias}
          diasDisponibles={agenda.diasDisponibles}
          estadoDias={agenda.estadoDias}
          onReintentarDias={agenda.reintentarDias}
          fecha={agenda.fecha}
          onElegirFecha={agenda.elegirFecha}
          horarios={agenda.horarios}
          estadoHorarios={agenda.estadoHorarios}
          onReintentarHorarios={agenda.reintentarHorarios}
          horario={horarioMarcado}
          onElegirHorario={elegirHorario}
          textoSinDias={textoSinDias}
          accionSinDias={barbero && (
            <Button variant="secondary" onClick={() => setBarbero(null)} full={false}>
              Ver con cualquier barbero
            </Button>
          )}
        />
      </div>
    </PageContainer>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────

/**
 * SelectorBarbero
 * Elección del barbero en dos partes: "Cualquier barbero" en su propio
 * renglón, a todo el ancho (es la opción por defecto y no es un barbero más),
 * y debajo los barberos como chips. Los chips no scrollean de costado: si no
 * entran, pasan al renglón siguiente, centrados.
 * Mientras la lista carga, dos chips en skeleton; si falló, un aviso con
 * "Reintentar" ("Cualquier barbero" sigue andando sin la lista).
 * @param {Object} props.barberos - { datos, cargando, error, reintentar }
 * @param {Object|null} props.elegido - Barbero marcado (null = "Cualquier barbero")
 * @param {Function} props.onElegir - Recibe el barbero tocado (null = "Cualquier barbero")
 */
function SelectorBarbero({ barberos, elegido, onElegir }) {
  return (
    <section aria-labelledby="cuando-barbero">
      <div id="cuando-barbero" style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        lineHeight: '16px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
        marginBottom: 8,
      }}>Barbero</div>

      <OpcionCualquiera marcada={!elegido} onClick={() => onElegir(null)}/>

      <ul style={{
        listStyle: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
      }}>
        {barberos.cargando
          ? [0, 1].map((i) => (
            <li key={i} aria-hidden="true">
              <Skeleton width={104} height={44} radius={999}/>
            </li>
          ))
          : barberos.datos.map((b) => (
            <li key={b.id} className="tt-aparecer" style={{ maxWidth: '100%' }}>
              <ChipBarbero
                barbero={b}
                marcado={elegido?.id === b.id}
                onClick={() => onElegir(b)}
              />
            </li>
          ))}
      </ul>

      {barberos.error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 4,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
        }}>
          No pudimos cargar el equipo.
          <Button variant="ghost" onClick={barberos.reintentar} full={false}>
            Reintentar
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * OpcionCualquiera
 * Renglón de ancho completo para "Cualquier barbero": ícono, texto y un
 * círculo que se completa con una tilde cuando está marcada. Es una tarjeta
 * de opción, no un botón negro: un negro a todo el ancho es el estilo del
 * botón principal ("Reservar turno") y se leería como "continuar".
 * Marcada: borde en el acento, de 2 px (el segundo píxel es una sombra
 * interior, así el renglón no cambia de alto).
 * @param {boolean} props.marcada
 * @param {Function} props.onClick
 */
function OpcionCualquiera({ marcada, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marcada}
      className="tt-presionable"
      style={{
        width: '100%',
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px 0 10px',
        background: theme.surface,
        border: `1px solid ${marcada ? theme.accent : theme.hairline}`,
        boxShadow: marcada ? `inset 0 0 0 1px ${theme.accent}` : 'none',
        borderRadius: theme.radius,
        color: theme.ink,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        textAlign: 'left',
        cursor: 'pointer',
        // `transform` acompaña al achique de tt-presionable (index.css) al tocar.
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      <IconoCualquiera/>
      <span style={{ flex: 1 }}>Cualquier barbero</span>
      <MarcaEleccion marcada={marcada}/>
    </button>
  );
}

/**
 * ChipBarbero
 * Chip tocable de 44 px de alto: avatar de iniciales + nombre. Marcado:
 * relleno con el acento. Un nombre más largo que el renglón se corta con "…".
 * @param {Object} props.barbero - { id, nombre }
 * @param {boolean} props.marcado
 * @param {Function} props.onClick
 */
function ChipBarbero({ barbero, marcado, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marcado}
      className="tt-presionable"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: '100%',
        height: 44,
        // 8 a la izquierda: el círculo de 28 queda concéntrico con la punta redonda.
        padding: '0 16px 0 8px',
        borderRadius: 999,
        border: `1px solid ${marcado ? theme.accent : theme.hairline}`,
        background: marcado ? theme.accent : theme.surface,
        color: marcado ? theme.accentInk : theme.ink,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        cursor: 'pointer',
        // `transform` acompaña al achique de tt-presionable (index.css) al tocar.
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, color ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      <span aria-hidden="true" style={{ display: 'flex' }}>
        <AvatarIniciales nombre={barbero.nombre} size={28}/>
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {barbero.nombre}
      </span>
    </button>
  );
}

/**
 * IconoCualquiera
 * Círculo de 28 px con dos siluetas, con el mismo fondo que las iniciales de
 * los barberos. Decorativo.
 */
function IconoCualquiera() {
  return (
    <span aria-hidden="true" style={{
      width: 28,
      height: 28,
      borderRadius: 999,
      background: theme.surfaceAlt,
      color: theme.inkSoft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75"/>
        <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
        <path d="M15.5 4.9a3.25 3.25 0 0 1 0 6.2M17.5 14.3c2 .7 3.5 2.6 3.5 5.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    </span>
  );
}

/**
 * MarcaEleccion
 * Círculo de 20 px a la derecha de una opción: vacío si no está marcada,
 * relleno con una tilde si lo está. Decorativo (el estado lo dice aria-pressed).
 * @param {boolean} props.marcada
 */
function MarcaEleccion({ marcada }) {
  return (
    <span aria-hidden="true" style={{
      width: 20,
      height: 20,
      borderRadius: 999,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: marcada ? theme.accent : 'transparent',
      border: `1.5px solid ${marcada ? theme.accent : theme.mutedSoft}`,
      color: theme.accentInk,
      transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
    }}>
      {marcada && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  );
}

export default SeleccionCuando;
