// /frontend/src/components/ui/index.js
// Barrel export — permite importar todo desde un solo lugar:
//   import { Button, Card, Field, ... } from '../components/ui';
//
// Empezó como los 13 primitivos universales del sistema de diseño (§6.1) +
// IconoAlerta, pero hoy es la superficie de import de TODOS los componentes
// compartidos del admin: tanto primitivos universales como componentes
// admin-domain reusados entre secciones (DataTable, BadgeFormaPago,
// BotonExportarExcel, etc.). Los wizard-only (Progress, MiniCalendario,
// SlotChip) NO se copian acá — son exclusivos del turnero por §6.2.

export { default as Button }          from './Button.jsx';
export { default as Card }            from './Card.jsx';
export { default as Field }           from './Field.jsx';
export { default as TopBar }          from './TopBar.jsx';
export { default as ScreenHeader }    from './ScreenHeader.jsx';
export { default as EmptyState }      from './EmptyState.jsx';
export { default as Skeleton }        from './Skeleton.jsx';
export { default as StatusPill }      from './StatusPill.jsx';
export { default as PageContainer }   from './PageContainer.jsx';
export { default as ConfirmDialog }   from './ConfirmDialog.jsx';
export { default as AvatarIniciales } from './AvatarIniciales.jsx';
export { default as SummaryRow }      from './SummaryRow.jsx';
export { default as IconoAlerta }     from './IconoAlerta.jsx';
export { default as LoadingState }    from './LoadingState.jsx';
export { default as Tabs }            from './Tabs.jsx';
export { default as Modal }           from './Modal.jsx';
export { default as Select }          from './Select.jsx';
export { default as BotonIconoFila }  from './BotonIconoFila.jsx';
export { default as DetalleRecurso }  from './DetalleRecurso.jsx';
export { default as BadgeVariacion }  from './BadgeVariacion.jsx';
export { default as ChipFiltro }      from './ChipFiltro.jsx';
export { default as DataTable }       from './DataTable.jsx';
export { default as BadgeEstado }     from './BadgeEstado.jsx';
export { default as ToggleEstado }    from './ToggleEstado.jsx';
export { default as Toast }           from './Toast.jsx';
export { default as InputTiempo }     from './InputTiempo.jsx';
export { default as FondoLocal }      from './FondoLocal.jsx';
export { default as LogoCirculo }     from './LogoCirculo.jsx';
export { default as TogglePill }       from './TogglePill.jsx';
export { default as BadgeFormaPago }   from './BadgeFormaPago.jsx';
export { default as BotonExportarExcel } from './BotonExportarExcel.jsx';
export { default as SelectorMes }      from './SelectorMes.jsx';
export { default as SelectorDia }      from './SelectorDia.jsx';
export { default as SelectorSemana }   from './SelectorSemana.jsx';
