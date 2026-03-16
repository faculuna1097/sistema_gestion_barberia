// /frontend/src/screens/admin/sections/SeccionCaja.jsx
// Sección de caja del panel de administrador.
// Tabs: Movimientos del día | Cierre de caja | Historial de cierres.
// Carga sus propios datos al montarse.

export default function SeccionCaja() {
  return (
    <div style={styles.contenedor}>
      <h2 style={styles.titulo}>Caja</h2>
      <p style={styles.subtitulo}>Próximamente: movimientos del día, cierre de caja e historial.</p>
    </div>
  );
}

const styles = {
  contenedor: {
    padding: "40px 48px",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  titulo: {
    fontSize: "28px", fontWeight: "700", color: "#111111", margin: "0 0 12px",
  },
  subtitulo: {
    fontSize: "16px", color: "#888888", margin: 0,
  },
};
