// /frontend/src/screens/admin/sections/SeccionInicio.jsx
// Sección de inicio del panel de administrador.
// Muestra KPIs del día y comparativo vs mes anterior.
// Carga sus propios datos al montarse (no recibe datos por props).

export default function SeccionInicio() {
  return (
    <div style={styles.contenedor}>
      <h2 style={styles.titulo}>Inicio</h2>
      <p style={styles.subtitulo}>Próximamente: KPIs del día y comparativo mensual.</p>
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
