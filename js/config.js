/**
 * Configuracion del frontend.
 * La URL base del backend se puede cambiar sin tocar el codigo:
 *   - definiendo window.SIA_API_BASE_URL antes de cargar los modulos, o
 *   - guardando localStorage.setItem('sia_api_base_url', 'http://host:puerto').
 * No contiene credenciales.
 */
export const config = {
  API_BASE_URL:
    window.SIA_API_BASE_URL ||
    localStorage.getItem('sia_api_base_url') ||
    'http://localhost:3000',
  REQUEST_TIMEOUT_MS: 15000,
  TOKEN_STORAGE_KEY: 'sia_token',
};

/**
 * Catalogos de estado y prioridad usados solo para etiquetas/colores de la UI.
 * PENDIENTE: confirmar los valores exactos con las constantes del backend (D).
 * La UI tambien se alimenta de lo que devuelva la API; estas claves solo
 * mapean un valor conocido a su estilo.
 */
export const INCIDENT_STATUS = {
  abierto: { label: 'Abierto', badge: 'status-open' },
  en_proceso: { label: 'En proceso', badge: 'status-progress' },
  resuelto: { label: 'Resuelto', badge: 'status-resolved' },
  cerrado: { label: 'Cerrado', badge: 'status-closed' },
};

export const INCIDENT_PRIORITY = {
  baja: { label: 'Baja', badge: 'priority-low' },
  media: { label: 'Media', badge: 'priority-medium' },
  alta: { label: 'Alta', badge: 'priority-high' },
  critica: { label: 'Crítica', badge: 'priority-critical' },
};
