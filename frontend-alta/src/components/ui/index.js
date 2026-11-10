// /frontend-alta/src/components/ui/index.js
// Barrel export de los primitivos — permite importar todo desde un solo lugar:
//   import { Button, Field, ... } from '../components/ui';
// Son copias de los de otros fronts (plan_alta_clientes.md §5.7): cada archivo
// dice de dónde sale y qué cambia.

export { default as Button }          from './Button.jsx';
export { default as Field }           from './Field.jsx';
export { default as AvatarIniciales } from './AvatarIniciales.jsx';
export { default as Skeleton }        from './Skeleton.jsx';
export { default as EmptyState }      from './EmptyState.jsx';
export { default as PageContainer }   from './PageContainer.jsx';
export { default as StickyFooter }    from './StickyFooter.jsx';
export { default as IconoWhatsApp }   from './IconoWhatsApp.jsx';
export { default as TextoError }      from './TextoError.jsx';
export { default as Select }          from './Select.jsx';
export { default as Casilla }         from './Casilla.jsx';
export { default as BotonOpcion }     from './BotonOpcion.jsx';
