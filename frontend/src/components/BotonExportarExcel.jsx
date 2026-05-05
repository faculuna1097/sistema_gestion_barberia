// /frontend/src/components/BotonExportarExcel.jsx

const ExcelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ marginRight: '6px', flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const estiloBase = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 18px',
  borderRadius: '10px',
  border: '1.5px solid #1a7a4a',
  backgroundColor: '#ffffff',
  color: '#1a7a4a',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const estiloDeshabilitado = {
  border: '1.5px solid #e0e0e0',
  color: '#bbbbbb',
  cursor: 'not-allowed',
};

export default function BotonExportarExcel({ onPointerDown, disabled = false }) {
  return (
    <button
      style={disabled ? { ...estiloBase, ...estiloDeshabilitado } : estiloBase}
      onPointerDown={disabled ? undefined : onPointerDown}
      disabled={disabled}
    >
      <ExcelIcon /> Exportar Excel
    </button>
  );
}
