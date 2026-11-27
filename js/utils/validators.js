/**
 * Validadores de cliente (solo UX). La validacion definitiva es del servidor.
 * Cada regla devuelve un mensaje de error o '' si es valida.
 */

export const rules = {
  required: (msg = 'Este campo es obligatorio') => (v) => (String(v ?? '').trim() ? '' : msg),
  minLength: (n, msg) => (v) =>
    !String(v ?? '').trim() || String(v).trim().length >= n ? '' : msg || `Debe tener al menos ${n} caracteres`,
  maxLength: (n, msg) => (v) => (String(v ?? '').trim().length <= n ? '' : msg || `No puede superar ${n} caracteres`),
  oneOf: (list, msg = 'Seleccione una opción válida') => (v) => (!v || list.includes(String(v)) ? '' : msg),
  email: (msg = 'Correo electrónico inválido') => (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : msg),
  dateRange: (getFrom, getTo, msg = 'La fecha inicial no puede ser posterior a la final') => () => {
    const from = getFrom();
    const to = getTo();
    return from && to && from > to ? msg : '';
  },
};

/** Ejecuta las reglas en orden y devuelve el primer error. */
export function validateValue(value, ruleList = []) {
  for (const rule of ruleList) {
    const error = rule(value);
    if (error) return error;
  }
  return '';
}

/** Muestra u oculta el error visual de un .form-group. */
export function setFieldError(field, message) {
  const group = field.closest('.form-group');
  if (!group) return;
  const errorEl = group.querySelector('.form-error');
  group.classList.toggle('is-invalid', Boolean(message));
  group.classList.toggle('is-valid', !message && String(field.value ?? '').trim() !== '');
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (errorEl) errorEl.textContent = message || '';
}

/**
 * Valida un formulario segun un esquema { nombreCampo: [reglas] }.
 * Valida en vivo (blur/input tras primer error). Devuelve { valid, values }.
 */
export function validateForm(form, schema) {
  const values = {};
  let valid = true;
  let firstInvalid = null;
  for (const [name, ruleList] of Object.entries(schema)) {
    const field = form.elements[name];
    if (!field) continue;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    values[name] = typeof value === 'string' ? value.trim() : value;
    const error = validateValue(value, ruleList);
    setFieldError(field, error);
    if (error) {
      valid = false;
      firstInvalid = firstInvalid || field;
    }
  }
  if (firstInvalid) firstInvalid.focus();
  return { valid, values };
}

/** Activa validacion en vivo sobre los campos del esquema. */
export function bindLiveValidation(form, schema) {
  for (const [name, ruleList] of Object.entries(schema)) {
    const field = form.elements[name];
    if (!field) continue;
    const run = () => setFieldError(field, validateValue(field.value, ruleList));
    field.addEventListener('blur', run);
    field.addEventListener('input', () => {
      if (field.closest('.form-group')?.classList.contains('is-invalid')) run();
    });
  }
}

export function resetFormErrors(form) {
  form.querySelectorAll('.form-group').forEach((g) => {
    g.classList.remove('is-invalid', 'is-valid');
    const e = g.querySelector('.form-error');
    if (e) e.textContent = '';
  });
}
