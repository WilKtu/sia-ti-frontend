/** Notificaciones Toast. */
import { el } from '../utils/dom.js';

let container;

function getContainer() {
  if (!container || !document.body.contains(container)) {
    container = el('div', { class: 'toast-container', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.append(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 4500) {
  const toast = el('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' }, [
    el('span', { class: 'toast__msg', text: message }),
    el('button', { type: 'button', class: 'toast__close', 'aria-label': 'Cerrar notificación', text: '×', onClick: () => dismiss() }),
  ]);
  let timer;
  function dismiss() {
    clearTimeout(timer);
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 200);
  }
  getContainer().append(toast);
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}

export const toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  error: (msg, d = 7000) => showToast(msg, 'error', d),
  warning: (msg, d) => showToast(msg, 'warning', d),
  info: (msg, d) => showToast(msg, 'info', d),
};
