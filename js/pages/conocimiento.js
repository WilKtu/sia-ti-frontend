import { initNavbar } from '../components/navbar.js';
import { createTable } from '../components/table.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { knowledgeApi } from '../api/knowledge.api.js';
import { catalogsApi } from '../api/incidents.api.js';
import { el, qs, debounce, setLoading } from '../utils/dom.js';
import { formatDate, orDash, normalize, truncate } from '../utils/format.js';
import { rules, validateForm, bindLiveValidation, setFieldError } from '../utils/validators.js';

const state = { categories: [], requestId: 0, all: [] };

/* ---------- Presentacion ---------- */
const stateBadges = (a) => el('div', { class: 'row', style: 'gap:6px' }, [
  el('span', { class: `badge ${a.active ? 'badge--success' : 'badge--neutral'}`, text: a.active ? 'Activo' : 'Inactivo' }),
  el('span', { class: `badge ${a.verified ? 'badge--info' : 'badge--warning'}`, text: a.verified ? 'Verificado' : 'Sin verificar' }),
  a.active && a.verified ? el('span', { class: 'badge badge--success', text: 'Elegible' }) : null,
]);

function toggle(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', checked, 'aria-label': label });
  const sw = el('label', { class: 'switch' }, [input, el('span', { class: 'switch__track', 'aria-hidden': 'true' }), el('span', { class: 'sr-only', text: label })]);
  input.addEventListener('change', () => onChange(input, input.checked));
  return sw;
}

/* ---------- Acciones de estado ---------- */
async function changeFlag(input, article, flag, value) {
  const isActive = flag === 'active';
  const verb = isActive ? (value ? 'activar' : 'desactivar') : (value ? 'marcar como verificado' : 'quitar la verificación de');
  const warn = !value ? ' Dejará de ser elegible como fuente de conocimiento.' : '';
  const ok = await confirmDialog({
    title: 'Confirmar cambio',
    message: `¿Desea ${verb} el artículo "${truncate(article.title, 60)}"?${warn}`,
    confirmText: 'Sí, continuar',
    danger: !value,
  });
  if (!ok) { input.checked = !value; return; }
  input.disabled = true;
  try {
    if (isActive) await knowledgeApi.setActive(article.id, value);
    else await knowledgeApi.setVerified(article.id, value);
    toast.success('Artículo actualizado correctamente.');
    await loadArticles();
  } catch (err) {
    input.checked = !value;
    input.disabled = false;
    toast.error(err.message);
  }
}

/* ---------- Tabla ---------- */
const table = createTable(qs('#articles-table'), {
  caption: 'Artículos de la base de conocimiento',
  pageSize: 10,
  onRetry: () => loadArticles(),
  empty: {
    icon: '📚',
    title: 'No hay artículos',
    message: 'No se encontraron artículos con los filtros actuales.',
    action: el('button', { type: 'button', class: 'btn btn-primary', text: '＋ Nuevo artículo', onClick: () => openForm() }),
  },
  columns: [
    { key: 'id', label: 'ID', sortable: true, className: 'cell-mono', render: (r) => `#${r.id}` },
    { key: 'title', label: 'Título', sortable: true, className: 'cell-title' },
    { key: 'category', label: 'Categoría', sortable: true },
    { key: 'status', label: 'Estado', render: stateBadges },
    { key: 'active', label: 'Activo', render: (r) => toggle(`Activar o desactivar artículo ${r.id}`, r.active, (i, v) => changeFlag(i, r, 'active', v)) },
    { key: 'verified', label: 'Verificado', render: (r) => toggle(`Marcar artículo ${r.id} como verificado`, r.verified, (i, v) => changeFlag(i, r, 'verified', v)) },
    { key: 'updatedAt', label: 'Actualizado', sortable: true, render: (r) => formatDate(r.updatedAt), sortValue: (r) => (r.updatedAt ? new Date(r.updatedAt).getTime() : 0) },
    {
      key: 'actions', label: 'Acciones',
      render: (r) => el('div', { class: 'cell-actions' }, [
        el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Ver', 'aria-label': `Ver artículo ${r.id}`, onClick: () => openDetail(r.id) }),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Editar', 'aria-label': `Editar artículo ${r.id}`, onClick: () => openForm(r) }),
      ]),
    },
  ],
});

/* ---------- Carga y filtros ---------- */
function applyFilters(list) {
  const q = normalize(qs('#f-search').value.trim());
  const st = qs('#f-state').value;
  const cat = qs('#f-category').value;
  return list.filter((a) => {
    if (q && !normalize(`${a.id} ${a.title} ${a.problem} ${a.symptoms} ${a.cause} ${a.solution}`).includes(q)) return false;
    if (cat && String(a.categoryId) !== cat) return false;
    if (st === 'eligible' && !(a.active && a.verified)) return false;
    if (st === 'inactive' && a.active) return false;
    if (st === 'unverified' && a.verified) return false;
    return true;
  });
}

async function loadArticles({ refetch = true } = {}) {
  if (!refetch) { table.setRows(applyFilters(state.all)); return; }
  const myRequest = ++state.requestId;
  table.setLoading('Cargando artículos...');
  try {
    const list = await knowledgeApi.list({ search: qs('#f-search').value.trim() });
    if (myRequest !== state.requestId) return;
    state.all = list;
    table.setRows(applyFilters(list));
  } catch (err) {
    if (myRequest !== state.requestId) return;
    table.setError(err.message);
    toast.error(err.message);
  }
}

async function loadCatalogs() {
  try {
    state.categories = await catalogsApi.categories();
    state.categories.forEach((c) => qs('#f-category').append(el('option', { value: c.id, text: c.name })));
  } catch (err) {
    toast.warning(`No se pudieron cargar las categorías: ${err.message}`);
  }
}

/* ---------- Detalle ---------- */
async function openDetail(id) {
  const body = el('div', { class: 'loading-state', role: 'status' }, [el('div', { class: 'spinner' }), el('span', { text: 'Cargando artículo...' })]);
  const closeBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Cerrar' });
  const modal = openModal({ title: `Artículo #${id}`, body, footer: [closeBtn], size: 'lg' });
  closeBtn.addEventListener('click', () => modal.close());
  try {
    const a = await knowledgeApi.get(id);
    body.replaceWith(el('dl', { class: 'detail-list' }, [
      el('dt', { text: 'Título' }), el('dd', { text: orDash(a.title) }),
      el('dt', { text: 'Categoría' }), el('dd', { text: orDash(a.category) }),
      el('dt', { text: 'Estado' }), el('dd', {}, [stateBadges(a)]),
      el('dt', { text: 'Problema' }), el('dd', { text: orDash(a.problem) }),
      el('dt', { text: 'Síntomas' }), el('dd', { text: orDash(a.symptoms) }),
      el('dt', { text: 'Causa' }), el('dd', { text: orDash(a.cause) }),
      el('dt', { text: 'Solución' }), el('dd', { text: orDash(a.solution) }),
    ]));
  } catch (err) {
    body.replaceWith(el('div', { class: 'alert alert--danger', role: 'alert', text: err.message }));
  }
}

/* ---------- Alta / edicion ---------- */
function field({ id, label, control, required = true, span2 = true, hint }) {
  return el('div', { class: `form-group ${span2 ? 'span-2' : ''}` }, [
    el('label', { class: 'form-label', for: id }, [label, required ? el('span', { class: 'req', 'aria-hidden': 'true', text: '*' }) : null]),
    control,
    hint ? el('span', { class: 'form-hint', text: hint }) : null,
    el('span', { class: 'form-error', id: `${id}-error`, role: 'alert' }),
  ]);
}

async function openForm(article) {
  const editing = Boolean(article);
  // Para editar se carga el articulo completo (la lista puede traer solo un resumen).
  let data = article || {};
  if (editing) {
    try { data = await knowledgeApi.get(article.id); } catch (err) { toast.error(err.message); return; }
  }
  const text = (id, name, rows, value, hint) => field({ id, label: hint.label, hint: hint.text, control: el('textarea', { class: 'textarea', id, name, maxlength: '4000', rows, 'aria-describedby': `${id}-error` }, [value || '']) });

  const form = el('form', { id: 'article-form', class: 'form-grid', novalidate: true }, [
    field({ id: 'a-title', label: 'Título', control: el('input', { class: 'input', id: 'a-title', name: 'title', maxlength: '200', value: data.title || '', 'aria-describedby': 'a-title-error' }) }),
    field({ id: 'a-category', label: 'Categoría', control: el('select', { class: 'select', id: 'a-category', name: 'categoryId' }, [el('option', { value: '', text: 'Seleccione...' }), ...state.categories.map((c) => el('option', { value: c.id, text: c.name, selected: String(c.id) === String(data.categoryId) }))]) }),
    text('a-problem', 'problem', 3, data.problem, { label: 'Problema', text: 'Qué le ocurre al usuario.' }),
    text('a-symptoms', 'symptoms', 3, data.symptoms, { label: 'Síntomas', text: 'Señales distinguibles: mensajes de error, comportamiento observable.' }),
    text('a-cause', 'cause', 3, data.cause, { label: 'Causa', text: 'Origen técnico más probable.' }),
    text('a-solution', 'solution', 5, data.solution, { label: 'Solución', text: 'Pasos accionables y numerados.' }),
  ]);

  const required = (m) => [rules.required(m), rules.minLength(10, 'Escriba al menos 10 caracteres'), rules.maxLength(4000)];
  const schema = {
    title: [rules.required('El título es obligatorio'), rules.minLength(5, 'El título debe tener al menos 5 caracteres'), rules.maxLength(200)],
    categoryId: [rules.required('Seleccione una categoría')],
    problem: required('El problema es obligatorio'),
    symptoms: required('Los síntomas son obligatorios'),
    cause: required('La causa es obligatoria'),
    solution: required('La solución es obligatoria'),
  };
  bindLiveValidation(form, schema);

  const submit = el('button', { type: 'submit', class: 'btn btn-primary', form: 'article-form', text: editing ? 'Guardar cambios' : 'Crear artículo' });
  const cancel = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Cancelar' });
  const notice = editing && data.active && data.verified
    ? el('div', { class: 'alert alert--warning', role: 'note', text: 'Este artículo es elegible como fuente. Tras editarlo, reindexe para actualizar la búsqueda del asistente.' })
    : null;
  const modal = openModal({ title: editing ? `Editar artículo #${data.id}` : 'Nuevo artículo', body: el('div', { class: 'stack' }, [notice, form]), footer: [cancel, submit], size: 'lg' });
  cancel.addEventListener('click', () => modal.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { valid, values } = validateForm(form, schema);
    if (!valid) return;
    setLoading(submit, true);
    try {
      if (editing) await knowledgeApi.update(data.id, values);
      else await knowledgeApi.create(values);
      toast.success(editing ? 'Artículo actualizado.' : 'Artículo creado. Quedará inactivo/sin verificar según las reglas del servidor.');
      modal.close('saved');
      loadArticles();
    } catch (err) {
      const d = err.details;
      if (d && typeof d === 'object') {
        const entries = Array.isArray(d) ? d.map((x) => [x.field || x.path, x.message || x.msg]) : Object.entries(d);
        entries.forEach(([k, msg]) => { const f = form.elements[k === 'category_id' ? 'categoryId' : k]; if (f && msg) setFieldError(f, String(msg)); });
      }
      toast.error(err.message);
    } finally {
      setLoading(submit, false);
    }
  });
}

/* ---------- Reindexar ---------- */
async function reindex() {
  const btn = qs('#btn-reindex');
  const ok = await confirmDialog({
    title: 'Reindexar conocimiento',
    message: 'Se reconstruirá el índice de búsqueda con los artículos activos y verificados. El proceso puede tardar unos momentos. ¿Continuar?',
    confirmText: 'Reindexar',
  });
  if (!ok) return;
  setLoading(btn, true);
  try {
    const res = await knowledgeApi.reindex();
    const info = res && (res.message || (res.data && res.data.message));
    toast.success(info || 'Reindexación iniciada correctamente.');
  } catch (err) {
    toast.error(`No se pudo reindexar: ${err.message}`);
  } finally {
    setLoading(btn, false);
  }
}

/* ---------- Inicio ---------- */
initNavbar();
qs('#btn-new').addEventListener('click', () => openForm());
qs('#btn-reindex').addEventListener('click', reindex);
qs('#f-search').addEventListener('input', debounce(() => loadArticles({ refetch: false }), 250));
qs('#f-state').addEventListener('change', () => loadArticles({ refetch: false }));
qs('#f-category').addEventListener('change', () => loadArticles({ refetch: false }));
qs('#filters-form').addEventListener('submit', (e) => { e.preventDefault(); loadArticles(); });
loadCatalogs().then(() => loadArticles());
