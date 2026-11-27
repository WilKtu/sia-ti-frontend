/**
 * Utilidades DOM. Nunca se usa innerHTML con datos de usuario (XSS):
 * el contenido se inserta siempre con textContent / createTextNode.
 */

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * Crea un elemento.
 * @param {string} tag
 * @param {object} [props] class, text, dataset, aria-*, eventos (onClick...) y atributos.
 * @param {Array<Node|string>} [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Vacia un nodo. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Reemplaza el contenido de un nodo. */
export function mount(node, ...children) {
  clear(node);
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** Debounce para busquedas mientras se escribe. */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Estado de carga en un boton. */
export function setLoading(button, loading) {
  button.classList.toggle('is-loading', loading);
  button.disabled = loading;
}

/** Estados de pantalla reutilizables. */
export function loadingState(text = 'Cargando...') {
  return el('div', { class: 'loading-state', role: 'status', 'aria-live': 'polite' }, [
    el('div', { class: 'spinner', 'aria-hidden': 'true' }),
    el('span', { text }),
  ]);
}

export function emptyState({ icon = '📭', title, message, action } = {}) {
  return el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-state__icon', 'aria-hidden': 'true', text: icon }),
    el('h3', { class: 'empty-state__title', text: title }),
    message ? el('p', { text: message }) : null,
    action || null,
  ]);
}

export function errorState({ title = 'No se pudo cargar la información', message, onRetry } = {}) {
  return el('div', { class: 'empty-state empty-state--error', role: 'alert' }, [
    el('div', { class: 'empty-state__icon', 'aria-hidden': 'true', text: '⚠️' }),
    el('h3', { class: 'empty-state__title', text: title }),
    message ? el('p', { text: message }) : null,
    onRetry ? el('button', { type: 'button', class: 'btn btn-secondary', text: 'Reintentar', onClick: onRetry }) : null,
  ]);
}
