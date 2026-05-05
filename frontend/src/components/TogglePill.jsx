// /frontend/src/components/TogglePill.jsx

const estiloBase = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 16px',
  borderRadius: '20px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
  fontFamily: "'DM Sans', Arial, sans-serif",
  transition: 'all 0.2s',
};

const estiloDot = {
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  flexShrink: 0,
};

const variantes = {
  activo:   { backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1.5px solid #a5d6a7' },
  inactivo: { backgroundColor: '#f5f5f5', color: '#888888', border: '1.5px solid #e0e0e0' },
};

export default function TogglePill({ activo, onToggle, labelOn, labelOff }) {
  const variante = activo ? variantes.activo : variantes.inactivo;
  const colorDot = activo ? '#2e7d32' : '#cccccc';
  const texto = activo ? labelOn : (labelOff ?? labelOn);

  return (
    <button onPointerDown={onToggle} style={{ ...estiloBase, ...variante }}>
      <span style={{ ...estiloDot, backgroundColor: colorDot }} />
      {texto}
    </button>
  );
}
