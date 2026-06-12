// /frontend-barbero/src/components/ui/index.js
// Barrel export — permite importar todo desde un solo lugar:
//   import { Button, Card, Field, ... } from '../components/ui';
//
// Nota: respecto al barrel del turnero, NO se incluyen Progress, MiniCalendario
// ni SlotChip — son primitivos wizard-only que no aplican a la app del barbero
// (ver docs/sistema_de_disenio.md §6.2).

export { default as Button }          from './Button.jsx';
export { default as Card }            from './Card.jsx';
export { default as Field }           from './Field.jsx';
export { default as TopBar }          from './TopBar.jsx';
export { default as ScreenHeader }    from './ScreenHeader.jsx';
export { default as StickyFooter }    from './StickyFooter.jsx';
export { default as EmptyState }      from './EmptyState.jsx';
export { default as Skeleton }        from './Skeleton.jsx';
export { default as StatusPill }      from './StatusPill.jsx';
export { default as PageContainer }   from './PageContainer.jsx';
export { default as ConfirmDialog }   from './ConfirmDialog.jsx';
export { default as AvatarIniciales } from './AvatarIniciales.jsx';
export { default as SummaryRow }      from './SummaryRow.jsx';
export { default as BottomNav }       from './BottomNav.jsx';
export { default as KPI }             from './KPI.jsx';
export { default as TurnoListItem }   from './TurnoListItem.jsx';
export { default as SearchInput }     from './SearchInput.jsx';
