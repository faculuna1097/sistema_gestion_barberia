// /frontend-turnero/src/components/DatosCliente.jsx
// Pantalla 6: el cliente ingresa nombre, teléfono y email.

import { useState } from 'react';

/**
 * DatosCliente
 * Formulario de datos del cliente. Todos los campos obligatorios.
 * @param {Object} props.datos - { nombre, telefono, email } (valores previos si vuelve)
 * @param {Function} props.onConfirmar - Callback con { nombre, telefono, email }
 * @param {Function} props.onVolver - Callback para retroceder
 */
function DatosCliente({ datos, onConfirmar, onVolver }) {
  const [nombre, setNombre] = useState(datos.nombre || '');
  const [telefono, setTelefono] = useState(datos.telefono || '');
  const [email, setEmail] = useState(datos.email || '');
  const [error, setError] = useState(null);

  /**
   * handleSubmit
   * Valida que los 3 campos estén completos y llama onConfirmar.
   */
  const handleSubmit = () => {
    if (!nombre.trim() || !telefono.trim() || !email.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email con formato inválido');
      return;
    }
    setError(null);
    onConfirmar({ nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim() });
  };

  return (
    <div>
      <button onPointerDown={onVolver}>← Volver</button>
      <h2>Tus datos</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginBottom: 8 }}>
        <label>Nombre</label><br />
        <input value={nombre} onChange={e => setNombre(e.target.value)} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>Teléfono</label><br />
        <input value={telefono} onChange={e => setTelefono(e.target.value)} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>Email</label><br />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>

      <button onPointerDown={handleSubmit}>Continuar</button>
    </div>
  );
}

export default DatosCliente;
