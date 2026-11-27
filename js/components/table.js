/**
 * Tabla interactiva reutilizable: ordenamiento, paginacion, estados de
 * carga/vacio/error y modo apilado en movil. Usa createElement (sin innerHTML).
 */
import { el, mount, loadingState, emptyState, errorState } from '../utils/dom.js';

/**
 * @param {HTMLElement} container
 * @param {object} opts
 *  columns: [{ key, label, sortable?, className?, render?(row) => Node|string, sortValue?(row) }]
 *  rowKey: string, pageSize?: number, caption: string,
 *  empty: { title, message, icon, action }, onRetry?: Function
 */
export function createTable(container, { columns, rowKey = 'id', pageSize = 10, caption = 'Tabla de datos', empty = {}, onRetry } = {}) {
  let rows = [];
  let sort = { key: null, dir: 'ascending' };
  let page = 1;

  function sortedRows() {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const get = col?.sortValue || ((r) => r[sort.key]);
    const factor = sort.dir === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true })) * factor;
    });
  }

  function onSort(key) {
    sort = { key, dir: sort.key === key && sort.dir === 'ascending' ? 'descending' : 'ascending' };
    page = 1;
    render();
  }

  function render() {
    if (!rows.length) {
      mount(container, emptyState({ title: 'Sin resultados', message: 'No hay registros para mostrar.', ...empty }));
      return;
    }
    const sorted = sortedRows();
    const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
    page = Math.min(page, pages);
    const slice = sorted.slice((page - 1) * pageSize, page * pageSize);

    const head = el('tr', {}, columns.map((c) => {
      const th = el('th', { scope: 'col', class: c.className || '' });
      if (c.sortable) {
        th.setAttribute('aria-sort', sort.key === c.key ? sort.dir : 'none');
        th.setAttribute('tabindex', '0');
        th.setAttribute('role', 'columnheader');
        th.append(c.label);
        th.addEventListener('click', () => onSort(c.key));
        th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(c.key); } });
      } else th.append(c.label);
      return th;
    }));

    const body = slice.map((row) =>
      el('tr', { dataset: { id: row[rowKey] } }, columns.map((c) => {
        const td = el('td', { class: c.className || '', 'data-label': c.label });
        const content = c.render ? c.render(row) : row[c.key];
        td.append(content instanceof Node ? content : document.createTextNode(content === null || content === undefined || content === '' ? '—' : String(content)));
        return td;
      })),
    );

    const table = el('table', { class: 'table table--stack' }, [
      el('caption', { class: 'sr-only', text: caption }),
      el('thead', {}, [head]),
      el('tbody', {}, body),
    ]);

    const prev = el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: '← Anterior', disabled: page <= 1, onClick: () => { page--; render(); } });
    const next = el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Siguiente →', disabled: page >= pages, onClick: () => { page++; render(); } });
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, sorted.length);

    mount(
      container,
      el('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': caption }, [table]),
      pages > 1 || sorted.length > pageSize
        ? el('div', { class: 'pagination' }, [
            el('span', { 'aria-live': 'polite', text: `Mostrando ${from}–${to} de ${sorted.length}` }),
            el('div', { class: 'pagination__controls' }, [prev, el('span', { text: `Página ${page} de ${pages}` }), next]),
          ])
        : el('div', { class: 'pagination' }, [el('span', { text: `${sorted.length} registro${sorted.length === 1 ? '' : 's'}` })]),
    );
  }

  return {
    setRows(data) { rows = Array.isArray(data) ? data : []; page = 1; render(); },
    setLoading(text) { mount(container, loadingState(text)); },
    setError(message) { mount(container, errorState({ message, onRetry })); },
    getRows: () => rows,
  };
}
