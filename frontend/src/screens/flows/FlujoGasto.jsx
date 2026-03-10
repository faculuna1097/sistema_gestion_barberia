export default function FlujoGasto({ onVolver }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "sans-serif" }}>
      <button onClick={onVolver}>← Volver (FlujoGasto — próximo paso)</button>
    </div>
  );
}