// /frontend/src/components/ui/DataTable.jsx
// Primitivo de tabla densa para el admin con sort por columna + paginación.
//
// Foco del primitivo: ordenar + paginar + render de filas. Filtros y selección
// son responsabilidad del caller (van afuera, típicamente en un toolbar con
// ChipFiltro o controles propios). Empty / loading también los maneja el
// caller — DataTable asume que recibe filas para mostrar.
//
// Aplica patrón D10 de tablas densas: thead eyebrow mono uppercase inkSoft
// sin bg + border-bottom hairline; filas con border-bottom hairlineSoft;
// sin zebra. Cuando hay onRowClick, la fila completa actúa como botón
// (cursor pointer + hover surfaceAlt scoped via <style> + Enter/Space).
//
// Decisiones:
// - Sort toggle binario asc/desc (sin estado "sin orden"). El primer click
//   sobre una columna inicia asc; clicks sucesivos alternan asc/desc.
// - Flecha de orden visible solo en la columna activa (ChevronUp/ChevronDown).
// - Paginación: el footer se renderiza solo si rows.length > pageSize. Al
//   cambiar sort, la página vuelve a 1. Si rows externamente se achican y
//   la página actual queda fuera de rango, se clampea al máximo.
//
// Primer uso: SeccionGestion / TabServicios (cierra deuda #20 del plan).

import { useState, useMemo, useId } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * DataTable
 * Tabla densa con sort por columna y paginación opcional.
 *
 * @param {object} props
 * @param {Array<{
 *   key: string,
 *   label: string,
 *   sortable?: boolean,
 *   align?: 'left'|'right'|'center',
 *   width?: number|string,
 *   grow?: boolean,
 *   render?: (row: any) => React.ReactNode,
 *   sortAccessor?: (row: any) => any,
 * }>} props.columns - Definición de columnas. `render` formatea el valor para
 *   la celda; `sortAccessor` formatea el valor para comparar al ordenar
 *   (default: row[col.key]). `grow: true` marca a la columna que absorbe el
 *   espacio sobrante de la tabla (las otras se ajustan a su contenido). Las
 *   columnas sin grow llevan whiteSpace nowrap → su ancho queda determinado
 *   por su contenido natural y no varía al cambiar de orden o página.
 * @param {Array<any>} props.rows - Datos a mostrar.
 * @param {(row: any) => string|number} props.rowKey - Devuelve la key estable
 *   de cada fila (típicamente row.id).
 * @param {(row: any) => void} [props.onRowClick] - Si está definido, cada fila
 *   actúa como botón (click + Enter/Space). Hover con bg surfaceAlt.
 * @param {number} [props.pageSize] - Si está definido y rows.length > pageSize,
 *   se pagina. Sin pageSize, render plano sin footer.
 */
function DataTable({ columns, rows, rowKey, onRowClick, pageSize }) {
  // Sort state: null = sin orden (orden natural de rows).
  const [sort, setSort] = useState(null); // { key, dir: 'asc'|'desc' } | null
  const [pagina, setPagina] = useState(1);
  // Hover sobre un header sortable inactivo — solo para mostrar el chevron
  // como hint de affordance, no afecta el orden hasta que se clickea.
  const [hoverKey, setHoverKey] = useState(null);

  // Clase única para scoping del hover de fila (evita colisión entre instancias).
  const idHover = useId().replace(/:/g, '');
  const claseFila = `om-dt-row-${idHover}`;

  /**
   * onClickHeader
   * Maneja el toggle de orden al clickear el header de una columna sortable.
   * @param {string} key
   */
  const onClickHeader = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
    setPagina(1);
  };

  // Filas ordenadas — memoizado para evitar reordenar en cada render.
  const filasOrdenadas = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const accessor = col.sortAccessor ?? ((row) => row[col.key]);
    const copia = [...rows];
    copia.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      // Comparación tolerante: numérica si ambos son números; lexicográfica
      // si son strings (case-insensitive); boolean → number.
      let cmp;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else if (typeof va === 'boolean' && typeof vb === 'boolean') {
        cmp = (va === vb) ? 0 : (va ? 1 : -1);
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'es', { sensitivity: 'base' });
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copia;
  }, [rows, sort, columns]);

  // Paginación — derivada de filas ordenadas.
  const paginado = typeof pageSize === 'number' && filasOrdenadas.length > pageSize;
  const totalPaginas = paginado ? Math.ceil(filasOrdenadas.length / pageSize) : 1;
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasVisibles = paginado
    ? filasOrdenadas.slice((paginaActual - 1) * pageSize, paginaActual * pageSize)
    : filasOrdenadas;

  // Estilos comunes de celdas.
  const thBase = {
    padding: '12px 16px',
    textAlign: 'left',
    fontFamily: theme.mono,
    fontSize: theme.sizeMicro,
    fontWeight: theme.weightHeading,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: theme.inkSoft,
    borderBottom: `1px solid ${theme.hairline}`,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };
  // Padding vertical 14px → fila ~46–48px (cumple §5.4, 44×44 min touch).
  // Separador hairline (no hairlineSoft) para que la zona clickable de cada
  // fila quede claramente delimitada al tacto en iPad.
  const tdBase = {
    padding: '14px 16px',
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    color: theme.ink,
    borderBottom: `1px solid ${theme.hairline}`,
    verticalAlign: 'middle',
    // tabular-nums en todas las celdas para que las cifras alineen parejo
    // (sin efecto sobre texto/íconos). Útil para "1 uds." vs "12 uds." vs
    // "$5.000" — todas las cifras quedan con el mismo ancho de glifo.
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div>
      {/* Scoping del hover de fila clickable. Sin clases globales — la clase
          es única por instancia del primitivo (useId). */}
      {onRowClick && (
        <style>{`
          .${claseFila}:hover { background: ${theme.surfaceAlt}; }
          .${claseFila}:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: -2px; }
        `}</style>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col) => {
                const activo = sort?.key === col.key;
                const align = col.align ?? 'left';
                const ArrowIcon = activo ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronUp;
                const hovered = col.sortable && !activo && hoverKey === col.key;
                // Iconito a opacidad 0/0.4/1 según estado — el slot siempre
                // existe (es la misma fuente layout) así no hay shift al
                // alternar orden ni al pasar el mouse.
                const iconOpacity = activo ? 1 : (hovered ? 0.4 : 0);
                return (
                  <th
                    key={col.key}
                    style={{
                      ...thBase,
                      textAlign: align,
                      // grow:true → la columna absorbe el espacio sobrante.
                      // Sin grow → whiteSpace nowrap fija el ancho al
                      // contenido natural (estable entre sort/páginas).
                      width: col.grow ? '100%' : col.width,
                      whiteSpace: col.grow ? 'normal' : 'nowrap',
                      cursor: col.sortable ? 'pointer' : 'default',
                      color: activo ? theme.ink : thBase.color,
                    }}
                    onClick={col.sortable ? () => onClickHeader(col.key) : undefined}
                    onMouseEnter={col.sortable ? () => setHoverKey(col.key) : undefined}
                    onMouseLeave={col.sortable ? () => setHoverKey(null) : undefined}
                    aria-sort={activo ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      {col.label}
                      {col.sortable && (
                        <span
                          aria-hidden={!activo}
                          style={{
                            display: 'inline-flex',
                            width: 14,
                            height: 14,
                            opacity: iconOpacity,
                            transition: `opacity ${theme.transitionFast}`,
                          }}
                        >
                          <ArrowIcon size={14} strokeWidth={2} />
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((row) => {
              const k = rowKey(row);
              const clickable = !!onRowClick;
              return (
                <tr
                  key={k}
                  className={clickable ? claseFila : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  onKeyDown={clickable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  } : undefined}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                >
                  {columns.map((col) => {
                    const align = col.align ?? 'left';
                    const valor = col.render ? col.render(row) : row[col.key];
                    return (
                      <td
                        key={col.key}
                        style={{
                          ...tdBase,
                          textAlign: align,
                          width: col.grow ? '100%' : col.width,
                          whiteSpace: col.grow ? 'normal' : 'nowrap',
                        }}
                      >
                        {valor}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paginado && (
        <PaginadorFooter
          pagina={paginaActual}
          totalPaginas={totalPaginas}
          onCambiar={setPagina}
        />
      )}
    </div>
  );
}

/**
 * PaginadorFooter
 * Footer con "Página X de Y" + botones prev/next. Sub-componente local: no se
 * exporta porque hoy solo lo usa DataTable. Si aparece un segundo caso, promover.
 *
 * @param {object} props
 * @param {number} props.pagina - Página actual (1-indexed).
 * @param {number} props.totalPaginas
 * @param {(n: number) => void} props.onCambiar
 */
function PaginadorFooter({ pagina, totalPaginas, onCambiar }) {
  const puedePrev = pagina > 1;
  const puedeNext = pagina < totalPaginas;

  const btnStyle = (habilitado) => ({
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.surface,
    border: `1px solid ${theme.hairline}`,
    borderRadius: theme.radius,
    color: habilitado ? theme.ink : theme.mutedSoft,
    cursor: habilitado ? 'pointer' : 'not-allowed',
    transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
    opacity: habilitado ? 1 : 0.6,
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderTop: `1px solid ${theme.hairline}`,
    }}>
      <span style={{
        fontFamily: theme.mono,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>
        Página {pagina} de {totalPaginas}
      </span>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={puedePrev ? () => onCambiar(pagina - 1) : undefined}
          disabled={!puedePrev}
          aria-label="Página anterior"
          style={btnStyle(puedePrev)}
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={puedeNext ? () => onCambiar(pagina + 1) : undefined}
          disabled={!puedeNext}
          aria-label="Página siguiente"
          style={btnStyle(puedeNext)}
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export default DataTable;
