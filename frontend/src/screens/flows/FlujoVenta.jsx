export default function FlujoVenta({ onVolver }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "sans-serif" }}>
      <button onClick={onVolver}>← Volver (FlujoVenta — próximo paso)</button>
    </div>
  );
}