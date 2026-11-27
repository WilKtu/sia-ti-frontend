/** Utilidades de formato. */

const LOCALE = 'es-GT';

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(LOCALE, { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
}

export function formatDateTime(value) {
  const d = toDate(value);
  return d
    ? d.toLocaleString(LOCALE, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';
}

/** Valor para <input type="date"> (YYYY-MM-DD) en hora local. */
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function truncate(text, max = 80) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Valor mostrable: vacio -> guion. */
export function orDash(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

/** "en_proceso" -> "En proceso" cuando no hay etiqueta definida. */
export function humanize(key) {
  const s = String(key ?? '').replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

/** Normaliza texto para busquedas sin acentos ni mayusculas. */
export function normalize(text) {
  return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
