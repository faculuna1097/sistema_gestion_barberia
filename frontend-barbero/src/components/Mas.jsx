// /frontend-barbero/src/components/Mas.jsx
// Pantalla "Más" — drilldown que agrupa secciones secundarias.
// Acceso a Clientes, Gestión y Cerrar sesión.
// Visible desde el BottomNav. Las pantallas a las que enlaza ocultan el nav
// (patrón de drilldown, vuelven con TopBar "← Volver").

import { Users, Settings, LogOut, ChevronRight } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { Card } from './ui';

/**
 * Mas
 * Lista de opciones secundarias. Cada item navega a una sub-pantalla
 * o ejecuta una acción (cerrar sesión).
 * @param {{ nombre: string }} props.barbero - Datos del barbero logueado
 * @param {() => void} props.onIrClientes
 * @param {() => void} props.onIrGestion
 * @param {() => void} props.onCerrarSesion
 */
function Mas({ barbero, onIrClientes, onIrGestion, onCerrarSesion }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '16px 16px 24px',
    }}>
      <ItemFila
        icon={Users}
        label="Clientes"
        descripcion="Historial de clientes atendidos"
        onClick={onIrClientes}
      />
      <ItemFila
        icon={Settings}
        label="Gestión"
        descripcion="Mis horarios y suspensiones"
        onClick={onIrGestion}
      />

      {/* Sesión actual + cerrar sesión, ancladas al fondo de la pantalla */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeMicro + 1,
          color: theme.muted,
          textAlign: 'center',
        }}>
          Sesión iniciada como {barbero?.nombre ?? '—'}
        </div>
        <ItemFila
          icon={LogOut}
          label="Cerrar sesión"
          descripcion={null}
          danger
          onClick={onCerrarSesion}
        />
      </div>
    </div>
  );
}

/**
 * ItemFila
 * Card horizontal: ícono | (label + descripción) | chevron.
 * Variante danger pinta el ícono y el label con color de peligro.
 * @param {React.ComponentType} props.icon - Componente de lucide-react
 * @param {string} props.label
 * @param {string|null} [props.descripcion]
 * @param {boolean} [props.danger=false]
 * @param {Function} props.onClick
 */
function ItemFila({ icon: Icon, label, descripcion, danger = false, onClick }) {
  const colorLabel = danger ? theme.danger : theme.ink;
  const colorIcon = danger ? theme.danger : theme.inkSoft;

  return (
    <Card onClick={onClick} padding={14}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <Icon
          size={20}
          strokeWidth={1.75}
          color={colorIcon}
          aria-hidden="true"
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightMedium,
            color: colorLabel,
            lineHeight: 1.3,
          }}>
            {label}
          </div>
          {descripcion && (
            <div style={{
              fontFamily: theme.body,
              fontSize: theme.sizeMicro + 1,
              color: theme.muted,
              marginTop: 2,
              lineHeight: 1.4,
            }}>
              {descripcion}
            </div>
          )}
        </div>

        <ChevronRight
          size={18}
          strokeWidth={1.75}
          color={theme.mutedSoft}
          aria-hidden="true"
        />
      </div>
    </Card>
  );
}

export default Mas;
