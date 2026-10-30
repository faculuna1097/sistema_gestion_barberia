// /frontend/src/screens/flows/wizardStyles.js
// Estilos de layout que los 3 flujos operativos (Corte/Venta/Gasto) componen
// dentro del PanelWizard: grillas de opciones, botón grande, texto de error.
// Viven aparte de wizard.jsx para que ese archivo exporte solo componentes
// (react-refresh/only-export-components).

import { theme } from "../../theme/tokens.js";

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
    fontSize: 18,
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
