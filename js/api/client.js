/**
 * Cliente HTTP base (fetch). Todos los modulos *.api.js deben reutilizarlo.
 */
import { config } from '../config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, details = null, kind = 'http' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details; // errores de validacion del servidor, si existen
    this.kind = kind; // 'http' | 'network' | 'timeout' | 'parse'
  }
}

const HTTP_MESSAGES = {
  400: 'La solicitud no es válida. Revise los datos enviados.',
  401: 'Su sesión no es válida o expiró.',
  403: 'No tiene permisos para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'La operación entra en conflicto con el estado actual del recurso.',
  422: 'Los datos enviados no superaron la validación.',
  500: 'Error interno del servidor. Intente de nuevo más tarde.',
  502: 'El servicio no está disponible temporalmente.',
  503: 'El servicio no está disponible temporalmente.',
};

export function getToken() {
  return localStorage.getItem(config.TOKEN_STORAGE_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(config.TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(config.TOKEN_STORAGE_KEY);
}

function buildUrl(path, params) {
  const base = config.API_BASE_URL.replace(/\/+$/, '');
  const url = new URL(base + (path.startsWith('/') ? path : `/${path}`));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/** Extrae un mensaje legible del cuerpo de error del servidor (formato no asumido). */
function extractMessage(body, status) {
  if (body && typeof body === 'object') {
    const msg = body.message || body.error || body.msg;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (msg && typeof msg === 'object' && msg.message) return String(msg.message);
  }
  return HTTP_MESSAGES[status] || `Error del servidor (HTTP ${status}).`;
}

async function request(method, path, { params, body, headers = {}, signal } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };
  const token = getToken();
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const options = { method, headers: finalHeaders };
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort());
  options.signal = controller.signal;

  let response;
  try {
    response = await fetch(buildUrl(path, params), options);
  } catch (err) {
    if (err.name === 'AbortError' && !signal?.aborted) {
      throw new ApiError('El servidor tardó demasiado en responder.', { kind: 'timeout' });
    }
    if (err.name === 'AbortError') throw err;
    throw new ApiError(
      `No se pudo conectar con el servidor (${config.API_BASE_URL}). Verifique que el backend esté en ejecución.`,
      { kind: 'network' },
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) throw new ApiError('El servidor devolvió una respuesta que no es JSON válido.', { status: response.status, kind: 'parse' });
      }
    }
  }

  if (!response.ok) {
    const details = data && (data.errors || data.details || null);
    throw new ApiError(extractMessage(data, response.status), { status: response.status, details });
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

/**
 * Desenvuelve respuestas tipo { data: ... } o arreglos directos.
 * PENDIENTE: confirmar el formato real con el backend.
 */
export function unwrap(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) return payload.data;
  return payload;
}

/** Normaliza una lista: acepta [..] o { data: [..] } o { items: [..] }. */
export function unwrapList(payload) {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}
