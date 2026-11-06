// /frontend/src/screens/flows/wizardStyles.js
// Estilos de layout que los 3 flujos operativos (Corte/Venta/Gasto) componen
// dentro del PanelWizard: grillas de opciones, botón grande, texto de error.
// Viven aparte de wizard.jsx para que ese archivo exporte solo componentes
// (react-refresh/only-export-components).

import { theme } from "../../theme/tokens.js";

/**
 * TAM_KIOSKO
 * Escala tipográfica de la superficie kiosko (sistema_de_disenio.md §3.6): más
 * grande que la de tokens.js porque los flujos se leen de pie, a un brazo del
 * iPad. Es una excepción escrita, no un descuido. Local a los flujos (§7.1): si
 * otra superficie la necesita, se promueve a tokens.js.
 */
export const TAM_KIOSKO = {
  opcion:          19, // BotonOpcion y CampoTexto
  botonGrande:     18, // wizardStyles.btnGrande
  valorResumen:    18, // valor de FilaResumen
  etiquetaResumen: 13, // etiqueta mono de FilaResumen
  subtitulo:       15, // subtítulo de PanelWizard
  etiquetaTotal:   22, // etiqueta de FilaTotal
  montoTotal:      32, // monto de FilaTotal
  signoMonto:      40, // "$" de CampoMonto
  campoMonto:      56, // input de CampoMonto
  montoExito:      48, // monto de PantallaExito
};

export const wizardStyles = {
  // Grilla de opciones: flex wrap centrado (la última fila incompleta queda centrada).
  gridOpciones: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  // Grilla de 2 columnas (forma de pago, Sí/No de propina).
  gridDos: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  mpLogo: {
    height: 52,
    width: "auto",
    objectFit: "contain",
  },
  // Botón grande (override del primitivo Button para superficie kiosko).
  btnGrande: {
    padding: "18px 24px",
    fontSize: TAM_KIOSKO.botonGrande,
    fontWeight: theme.weightHeading,
  },
  errorTexto: {
    color: theme.danger,
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    textAlign: "center",
    margin: 0,
  },
};
