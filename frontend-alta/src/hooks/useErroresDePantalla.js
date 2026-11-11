// /frontend-alta/src/hooks/useErroresDePantalla.js
// Los errores de una pantalla: los del front (erroresDePantalla, las reglas de
// validaciones.js) más los que marcó el backend al enviar y que siguen
// valiendo (utils/erroresServidor.js). Así un error que solo ve el backend
// (ej. un link que otra barbería tomó entre medio) se muestra en su campo
// como cualquier otro, y desaparece apenas se corrige ese campo.
//
// Formulario guarda los errores del backend y los reparte con
// ErroresServidorContext; cada pantalla llama a este hook en lugar de a
// erroresDePantalla.

import { createContext, useContext } from 'react';
import { erroresDePantalla, pantallaDeCampo } from '../utils/validaciones.js';
import { combinarErrores, erroresServidorVigentes } from '../utils/erroresServidor.js';

/**
 * ErroresServidorContext
 * Los errores del último 400 del envío, como los registra
 * registrarErroresServidor (con la huella del valor de cada campo). Vacío
 * mientras no hubo un envío con errores.
 */
export const ErroresServidorContext = createContext([]);

/**
 * useErroresDePantalla
 * @param {number} pantalla - Número de pantalla (config/pantallas.js → PANTALLA)
 * @param {Object} datos - El formulario completo
 * @returns {Array<{campo: string, mensaje: string}>} Primero los del front, en
 *   el orden del formulario, y después los del backend en otros campos.
 */
export function useErroresDePantalla(pantalla, datos) {
  const registrados = useContext(ErroresServidorContext);
  const delServidor = erroresServidorVigentes(registrados, datos)
    .filter((error) => pantallaDeCampo(error.campo) === pantalla);
  return combinarErrores(erroresDePantalla(pantalla, datos), delServidor);
}
