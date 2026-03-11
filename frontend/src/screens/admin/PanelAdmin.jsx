// /frontend/src/screens/admin/PanelAdmin.jsx
// Pantalla placeholder del Panel de Administrador.
// Por ahora solo muestra que el acceso fue exitoso.
// Props:
//   onSalir — función para volver a la pantalla principal

export default function PanelAdmin({ onSalir }) {
  console.log('[PanelAdmin] Montado');

  return (
    <div style={styles.pantalla}>
      <div style={styles.lineaSuperior} />
      <p style={styles.texto}>Panel de Administrador</p>
      <button style={styles.btnSalir} onClick={() => {
        console.log('[PanelAdmin] Cerrando sesión — volviendo a pantalla principal');
        onSalir();
      }}>
        Cerrar sesión
      </button>
    </div>
  );
}

const styles = {
  pantalla: {
    width: "100vw", height: "100vh", backgroundColor: "#ffffff",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "24px",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    position: "relative",
  },
  lineaSuperior: {
    position: "absolute", top: 0, left: 0, right: 0, height: "4px",
    background: "linear-gradient(90deg, #1a7a4a 0%, #2dba6e 50%, #1a7a4a 100%)",
  },
  texto: {
    fontSize: "28px", fontWeight: "700", color: "#111111", margin: 0,
  },
  btnSalir: {
    padding: "14px 32px", borderRadius: "12px", border: "1.5px solid #e8e8e8",
    backgroundColor: "#fafafa", color: "#555555", fontSize: "16px",
    fontWeight: "500", cursor: "pointer",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
};
