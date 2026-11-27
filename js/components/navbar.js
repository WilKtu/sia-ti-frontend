/**
 * Navbar compartido. Cada pagina incluye <div id="navbar-root"></div> y llama
 * a initNavbar(); asi el menu existe en un unico lugar.
 */
import { el } from '../utils/dom.js';

export const NAV_ITEMS = [
  { href: 'index.html', label: 'Dashboard', icon: '📊' },
  { href: 'incidentes.html', label: 'Incidentes', icon: '🛠️' },
  { href: 'conocimiento.html', label: 'Base de conocimiento', icon: '📚' },
  { href: 'asistente.html', label: 'Asistente inteligente', icon: '🤖' },
  { href: 'historial.html', label: 'Historial', icon: '🕘' },
];

function logo() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', 'navbar__logo');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (tag, attrs) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };
  svg.append(
    mk('path', { d: 'M16 2 28 9v14l-12 7L4 23V9z', fill: 'none', stroke: '#22e5ff', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
    mk('circle', { cx: '16', cy: '16', r: '4', fill: '#2f7bff' }),
    mk('path', { d: 'M16 12V6M16 20v6M12.5 14 7 11M19.5 18l5.5 3', stroke: '#22e5ff', 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
  );
  return svg;
}

export function initNavbar(root = document.getElementById('navbar-root')) {
  if (!root) return;
  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const toggle = el('button', {
    type: 'button', class: 'navbar__toggle', 'aria-expanded': 'false', 'aria-controls': 'navbar-menu', 'aria-label': 'Abrir menú de navegación',
  }, [el('span', { class: 'navbar__toggle-bars' })]);

  const menu = el('ul', { class: 'navbar__menu', id: 'navbar-menu' }, NAV_ITEMS.map((item) => {
    const link = el('a', { class: 'navbar__link', href: item.href }, [el('span', { 'aria-hidden': 'true', text: item.icon }), el('span', { text: item.label })]);
    if (item.href.toLowerCase() === current) link.setAttribute('aria-current', 'page');
    return el('li', {}, [link]);
  }));

  const nav = el('nav', { class: 'navbar', 'aria-label': 'Navegación principal' }, [
    el('div', { class: 'navbar__inner' }, [
      el('a', { class: 'navbar__brand', href: 'index.html', 'aria-label': 'SIA TI - Inicio' }, [
        logo(),
        el('span', {}, ['SIA TI', el('small', { text: 'Gestión inteligente de incidentes' })]),
      ]),
      toggle,
      menu,
    ]),
  ]);

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
  };

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
  window.matchMedia('(min-width: 801px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

  root.replaceWith(nav);
  return nav;
}
