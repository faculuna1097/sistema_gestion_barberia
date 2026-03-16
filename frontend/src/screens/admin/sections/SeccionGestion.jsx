// /frontend/src/screens/admin/sections/SeccionGestion.jsx
// Sección de gestión del panel de administrador.
// ABM: Barberos, Servicios, Productos, Datos del negocio, PIN admin.
// Carga sus propios datos al montarse.

export default function SeccionGestion() {
  return (
    <div style={styles.contenedor}>
      <h2 style={styles.titulo}>Gestión</h2>
      <p style={styles.subtitulo}>Próximamente: ABM de barberos, servicios y productos.</p>
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
