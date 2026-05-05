// /frontend/src/components/BadgeFormaPago.jsx

const estiloBase = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '600',
};

const variantes = {
  efectivo:     { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  mercado_pago: { backgroundColor: '#e3f2fd', color: '#1565c0' },
};

export default function BadgeFormaPago({ forma }) {
  const variante = variantes[forma] || variantes.mercado_pago;
  return (
    <span style={{ ...estiloBase, ...variante }}>
      {forma === 'efectivo' ? 'Efectivo' : 'Mercado Pago'}
    </span>
  );
}
