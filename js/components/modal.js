/** Modales reutilizables con foco atrapado, Escape y retorno de foco. */
import { el } from '../utils/dom.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let uid = 0;

/**
 * Abre un modal.
 * @param {object} opts { title, body: Node, footer?: Node[], size?: 'sm'|'lg', onClose? }
 * @returns {{close: Function, element: HTMLElement}}
 */
export function openModal({ title, body, footer = [], size = '', onClose } = {}) {
  const previouslyFocused = document.activeElement;
  const titleId = `modal-title-${++uid}`;

  const closeBtn = el('button', { type: 'button', class: 'modal__close', 'aria-label': 'Cerrar', text: '×' });
  const dialog = el(
    'div',
    { class: `modal ${size ? `modal--${size}` : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    [
      el('div', { class: 'modal__header' }, [el('h2', { class: 'modal__title', id: titleId, text: title }), closeBtn]),
      el('div', { class: 'modal__body' }, [body]),
      footer.length ? el('div', { class: 'modal__footer' }, footer) : null,
    ],
  );
  const backdrop = el('div', { class: 'modal-backdrop' }, [dialog]);

  function close(result) {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    document.body.style.overflow = '';
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (onClose) onClose(result);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close('dismiss');
    } else if (e.key === 'Tab') {
      const items = Array.from(dialog.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  closeBtn.addEventListener('click', () => close('dismiss'));
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close('dismiss'); });
  document.addEventListener('keydown', onKey, true);
  document.body.style.overflow = 'hidden';
  document.body.append(backdrop);

  const firstField = dialog.querySelector('input:not([type=hidden]), select, textarea');
  (firstField || dialog).focus();

  return { close, element: dialog };
}

/**
 * Dialogo de confirmacion. Devuelve Promise<boolean>.
 */
export function confirmDialog({ title = 'Confirmar acción', message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modal.close('done');
      resolve(value);
    };
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: cancelText, onClick: () => finish(false) });
    const okBtn = el('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, text: confirmText, onClick: () => finish(true) });
    const modal = openModal({
      title,
      size: 'sm',
      body: el('p', { text: message }),
      footer: [cancelBtn, okBtn],
      onClose: () => { if (!settled) { settled = true; resolve(false); } },
    });
    okBtn.focus();
  });
}
