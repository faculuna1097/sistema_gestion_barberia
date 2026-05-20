// /frontend-barbero/src/components/Clientes.jsx
// Lista de clientes que alguna vez tuvieron un turno con el barbero autenticado.
// Pantalla drilldown desde "Más" → el TopBar usa onVolver para regresar.
// Muestra nombre, contacto (linkeable tel:/mailto:), total de visitas y última visita.

import { useState, useEffect, useCallback } from 'react';
import { UserX } from 'lucide-react';

import { getMisClientes } from '../services/api.js';
import { theme } from '../theme/tokens.js';

import {
  TopBar,
  ScreenHeader,
  Card,
  Skeleton,
  EmptyState,
  Button,
  AvatarIniciales,
  SearchInput,
} from './ui';

// ─── Helpers locales ────────────────────────────────────────────────────────

/**
 * fmtFechaUltimaVisita
 * Formato "DD/MM/YYYY" — incluye año porque la última visita puede ser de años atrás.
 * Local porque por ahora es el único caso que necesita año.
 * @param {string|null} iso
 * @returns {string}
 */
function fmtFechaUltimaVisita(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * coincideConFiltro
 * Devuelve true si el cliente coincide con el texto de búsqueda en
 * cualquiera de los campos: nombre, email o teléfono.
 * @param {Object} cliente
 * @param {string} texto - Texto en minúsculas, ya trimeado.
 * @returns {boolean}
 */
function coincideConFiltro(cliente, texto) {
  if (!texto) return true;
  const nombre = (cliente.nombre || '').toLowerCase();
  const email  = (cliente.email  || '').toLowerCase();
  const tel    = cliente.telefono || '';
  return nombre.includes(texto) || email.includes(texto) || tel.includes(texto);
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clientes
 * Pantalla "Mis clientes" — listado read-only con filtro local.
 * @param {() => void} props.onVolver - Callback al tocar "← Volver" en TopBar.
 */
export default function Clientes({ onVolver }) {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');

  /**
   * cargar
   * Trae los clientes históricos del barbero autenticado.
   */
  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await getMisClientes();
      setClientes(data);
      console.log('[Clientes] cargar — completado |', data.length, 'clientes');
    } catch (err) {
      console.error('[Clientes] Error cargando clientes:', err.message);
      setError('No se pudo cargar la lista de clientes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const textoFiltro = filtro.trim().toLowerCase();
  const clientesFiltrados = clientes.filter((c) => coincideConFiltro(c, textoFiltro));

  const filtroActivo = textoFiltro.length > 0;

  return (
    <>
      <TopBar onVolver={onVolver} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '0 16px 24px',
      }}>
        <ScreenHeader
          eyebrow="Mis clientes"
          title="Mis clientes"
          subtitle={
            cargando
              ? 'Cargando…'
              : `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'} en total`
          }
        />

        <SearchInput
          value={filtro}
          onChange={setFiltro}
          placeholder="Buscar por nombre, email o teléfono…"
          ariaLabel="Buscar cliente"
        />

        {cargando && <ListaSkeleton />}

        {!cargando && error && (
          <EmptyState
            glyph={<UserX size={28} strokeWidth={1.5} aria-hidden="true" />}
            title="No pudimos cargar la lista"
            body={error}
            action={
              <Button variant="secondary" full={false} onClick={cargar}>
                Reintentar
              </Button>
            }
          />
        )}

        {!cargando && !error && clientes.length === 0 && (
          <EmptyState
            glyph={<UserX size={28} strokeWidth={1.5} aria-hidden="true" />}
            title="Todavía no atendiste a nadie"
            body="Cuando registres tu primer corte, el cliente va a aparecer acá."
          />
        )}

        {!cargando && !error && clientes.length > 0 && clientesFiltrados.length === 0 && (
          <EmptyState
            glyph={<UserX size={28} strokeWidth={1.5} aria-hidden="true" />}
            title="Sin coincidencias"
            body={`Ningún cliente coincide con "${filtro.trim()}".`}
            action={
              <Button variant="secondary" full={false} onClick={() => setFiltro('')}>
                Limpiar búsqueda
              </Button>
            }
          />
        )}

        {!cargando && !error && clientesFiltrados.length > 0 && (
          <>
            {filtroActivo && (
              <div style={{
                fontFamily: theme.body,
                fontSize: theme.sizeMicro + 1,
                color: theme.muted,
                marginTop: -8,
              }}>
                {clientesFiltrados.length} de {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientesFiltrados.map((c) => (
                <ClienteFila key={c.id} cliente={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-componentes locales
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ClienteFila
 * Card de un cliente con avatar + datos + contacto.
 * Tel y email se renderizan como links nativos (tel:/mailto:) si existen.
 * @param {Object} props.cliente
 */
function ClienteFila({ cliente }) {
  const visitas = Number(cliente.total_visitas || 0);
  const ultima  = fmtFechaUltimaVisita(cliente.ultima_visita);

  return (
    <Card padding={12}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <AvatarIniciales nombre={cliente.nombre || '?'} size={40} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightMedium,
            color: theme.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {cliente.nombre || 'Sin nombre'}
          </div>

          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeMicro + 1,
            color: theme.muted,
            marginTop: 2,
          }}>
            {visitas} {visitas === 1 ? 'visita' : 'visitas'} · última: {ultima}
          </div>

          {(cliente.telefono || cliente.email) && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 6,
              fontFamily: theme.body,
              fontSize: theme.sizeMicro + 1,
            }}>
              {cliente.telefono && (
                <LinkContacto href={`tel:${cliente.telefono}`} texto={cliente.telefono} />
              )}
              {cliente.email && (
                <LinkContacto href={`mailto:${cliente.email}`} texto={cliente.email} />
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * LinkContacto
 * Link discreto para tel:/mailto:. Color accent, sin underline por default.
 */
function LinkContacto({ href, texto }) {
  return (
    <a
      href={href}
      style={{
        color: theme.accent,
        textDecoration: 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {texto}
    </a>
  );
}

/**
 * ListaSkeleton
 * Esqueleto de carga: 4 cards con silueta de avatar + 2 líneas.
 */
function ListaSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} padding={12}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Skeleton width={40} height={40} radius={999} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton height={14} width="60%" />
              <Skeleton height={12} width="40%" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
