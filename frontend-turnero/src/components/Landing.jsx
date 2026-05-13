// /frontend-turnero/src/components/Landing.jsx
// Pantalla 1: Landing del tenant — logo, nombre, botón "Reservar turno".

/**
 * Landing
 * Muestra la info pública del tenant y el botón para iniciar el wizard.
 * @param {Object} props.tenant - { id, nombre, logo_url }
 * @param {Function} props.onReservar - Callback al presionar el botón
 */
function Landing({ tenant, onReservar }) {
  return (
    <div>
      {tenant.logo_url && (
        <img src={tenant.logo_url} alt={tenant.nombre} style={{ maxWidth: 150 }} />
      )}
      <h1>{tenant.nombre}</h1>
      <button onPointerDown={onReservar}>Reservar turno</button>
    </div>
  );
}

export default Landing;
