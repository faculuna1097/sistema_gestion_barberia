// /frontend/src/screens/admin/sections/SeccionVentas.jsx
// Sección de ventas del panel de administrador.
// Dos tablas: servicios realizados + productos vendidos (mensual).
// Carga sus propios datos al montarse.

export default function SeccionVentas() {
  return (
    <div style={styles.contenedor}>
      <h2 style={styles.titulo}>Ventas</h2>
      <p style={styles.subtitulo}>Próximamente: servicios y productos del mes.</p>
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
