// /frontend-alta/src/hooks/useEstadoSubdominio.js
// Si el link que eligió el cliente se puede usar, mientras lo escribe (pantalla
// del nombre). El formato y los reservados se resuelven acá, sin pedido
// (utils/subdominio.js); si el formato es válido, se pregunta al backend si lo
// usa otra barbería (consultarSubdominio), con debounce y cancelando la
// consulta anterior.
//
// Si la consulta falla o tarda demasiado, el estado es SIN_RESPUESTA: la
// pantalla avisa y deja seguir. El backend lo vuelve a revisar al enviar.

import { useEffect, useState } from 'react';
import { consultarSubdominio } from '../services/api.js';
import { motivoFormatoSubdominio } from '../utils/subdominio.js';

/**
 * ESTADOS_SUBDOMINIO
 * - VACIO: no hay link todavía.
 * - FORMATO: el formato no sirve (la pantalla lo muestra recién al salir del campo o al seguir).
 * - VERIFICANDO: esperando el debounce o la respuesta.
 * - DISPONIBLE / OCUPADO / RESERVADO: el resultado.
 * - SIN_RESPUESTA: la consulta falló o tardó más de TOPE_CONSULTA_MS.
 */
export const ESTADOS_SUBDOMINIO = {
  VACIO: 'vacio',
  FORMATO: 'formato',
  VERIFICANDO: 'verificando',
  DISPONIBLE: 'disponible',
  OCUPADO: 'ocupado',
  RESERVADO: 'reservado',
  SIN_RESPUESTA: 'sin_respuesta',
};

// Espera desde la última tecla antes de consultar.
const DEBOUNCE_MS = 400;
// Una consulta que tarda más que esto se da por perdida: no deja trabado el "Seguir".
const TOPE_CONSULTA_MS = 6000;

// Resultados ya conocidos en esta carga de la página (disponible u ocupado):
// al volver a la pantalla o al reescribir un link ya consultado, el estado sale
// al instante y sin pedido.
const resultados = new Map();

/**
 * estadoSinPedido (interna)
 * Lo que se sabe de un link sin preguntarle al backend.
 * @param {string} valor
 * @returns {string|null} VACIO, FORMATO o un resultado guardado; null si hay que consultar.
 */
function estadoSinPedido(valor) {
  if (!valor) return ESTADOS_SUBDOMINIO.VACIO;
  if (motivoFormatoSubdominio(valor) === 'formato') return ESTADOS_SUBDOMINIO.FORMATO;
  return resultados.get(valor) ?? null;
}

/**
 * useEstadoSubdominio
 * @param {string} valor - El subdominio actual (local.subdominio)
 * @returns {string} Uno de ESTADOS_SUBDOMINIO.
 */
export function useEstadoSubdominio(valor) {
  // El último resultado que llegó, con el valor al que corresponde: si el valor
  // cambió desde entonces, todavía se está verificando.
  const [ultimo, setUltimo] = useState({ valor: null, estado: null });
  const conocido = estadoSinPedido(valor);

  useEffect(() => {
    if (conocido !== null) return undefined;

    let cancelada = false;
    const control = new AbortController();
    let tope = null;

    const espera = setTimeout(async () => {
      // Reservado se decide sin pedido, pero después del debounce: así no
      // parpadea mientras se escribe un nombre que empieza como uno reservado.
      if (motivoFormatoSubdominio(valor) === 'reservado') {
        setUltimo({ valor, estado: ESTADOS_SUBDOMINIO.RESERVADO });
        return;
      }
      tope = setTimeout(() => control.abort(), TOPE_CONSULTA_MS);
      try {
        const { disponible, motivo } = await consultarSubdominio(valor, { signal: control.signal });
        let estado = ESTADOS_SUBDOMINIO.DISPONIBLE;
        if (!disponible) estado = motivo === 'reservado' ? ESTADOS_SUBDOMINIO.RESERVADO : ESTADOS_SUBDOMINIO.OCUPADO;
        if (motivo === 'formato') estado = ESTADOS_SUBDOMINIO.FORMATO;
        resultados.set(valor, estado);
        if (!cancelada) setUltimo({ valor, estado });
      } catch (err) {
        if (cancelada) return;
        console.warn('[useEstadoSubdominio] no se pudo consultar el link:', err.message);
        setUltimo({ valor, estado: ESTADOS_SUBDOMINIO.SIN_RESPUESTA });
      } finally {
        clearTimeout(tope);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelada = true;
      clearTimeout(espera);
      clearTimeout(tope);
      control.abort();
    };
  }, [valor, conocido]);

  if (conocido !== null) return conocido;
  return ultimo.valor === valor ? ultimo.estado : ESTADOS_SUBDOMINIO.VERIFICANDO;
}
