import { initNavbar } from '../components/navbar.js';
import { createTable } from '../components/table.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { incidentsApi, catalogsApi } from '../api/incidents.api.js';
import { INCIDENT_STATUS, INCIDENT_PRIORITY } from '../config.js';
import { el, qs, debounce, setLoading } from '../utils/dom.js';
import { formatDate, formatDateTime, orDash, humanize, normalize } from '../utils/format.js';
import { rules, validateForm, bindLiveValidation, setFieldError } from '../utils/validators.js';

const state = { categories: [], users: [], requestId: 0 };

/* ---------- Helpers de presentacion ---------- */
const statusBadge = (s) => {
  const info = INCIDENT_STATUS[s];
  return el('span', { class: `badge badge--${info ? info.badge : 'neutral'}`, text: info ? info.label : humanize(s) });
};
const priorityBadge = (p) => {
  const info = INCIDENT_PRIORITY[p];
  return el('span', { class: `badge badge--${info ? info.badge : 'neutral'}`, text: info ? info.label : humanize(p) });
};

/* ---------- Tabla ---------- */
const PRIORITY_ORDER = Object.keys(INCIDENT_PRIORITY);

const table = createTable(qs('#incidents-table'), {
  caption: 'Listado de incidentes',
  pageSize: 10,
  onRetry: () => loadIncidents(),
  empty: {
    icon: '🎉',
    title: 'No hay incidentes',
    message: 'No se encontraron incidentes con los filtros actuales.',
    action: el('button', { type: 'button', class: 'btn btn-primary', text: '＋ Nuevo incidente', onClick: () => openCreateModal() }),
  },
  columns: [
    { key: 'id', label: 'ID', sortable: true, className: 'cell-mono', render: (r) => `#${r.id}` },
    { key: 'title', label: 'Título', sortable: true, className: 'cell-title' },
    { key: 'category', label: 'Categoría', sortable: true },
    { key: 'priority', label: 'Prioridad', sortable: true, render: (r) => priorityBadge(r.priority), sortValue: (r) => PRIORITY_ORDER.indexOf(r.priority) },
    { key: 'status', label: 'Estado', sortable: true, render: (r) => statusBadge(r.status) },
    { key: 'assignedTo', label: 'Asignado a', sortable: true, render: (r) => orDash(r.assignedTo) },
    { key: 'createdAt', label: 'Creado', sortable: true, render: (r) => formatDate(r.createdAt), sortValue: (r) => (r.createdAt ? new Date(r.createdAt).getTime() : 0) },
    {
      key: 'actions', label: 'Acciones',
      render: (r) => el('div', { class: 'cell-actions' }, [
        el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Ver', 'aria-label': `Ver detalle del incidente ${r.id}`, onClick: () => openDetail(r.id) }),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Estado', 'aria-label': `Cambiar estado del incidente ${r.id}`, onClick: () => openStatusModal(r) }),
      ]),
    },
  ],
});

/* ---------- Filtros ---------- */
const filtersForm = qs('#filters-form');
const rangeError = qs('#f-range-error');

function readFilters() {
  const f = Object.fromEntries(new FormData(filtersForm).entries());
  return { search: (f.search || '').trim(), status: f.status, categoryId: f.categoryId, priority: f.priority, from: f.from, to: f.to };
}

/** Filtra tambien en cliente: asegura el comportamiento aunque el backend ignore algun parametro. */
function applyClientFilters(list, f) {
  const q = normalize(f.search);
  const from = f.from ? new Date(`${f.from}T00:00:00`).getTime() : null;
  const to = f.to ? new Date(`${f.to}T23:59:59.999`).getTime() : null;
  return list.filter((i) => {
    if (q && !normalize(`${i.id} ${i.title} ${i.description}`).includes(q)) return false;
    if (f.status && i.status !== f.status) return false;
    if (f.priority && i.priority !== f.priority) return false;
    if (f.categoryId && String(i.categoryId) !== String(f.categoryId)) return false;
    if (from || to) {
      const t = i.createdAt ? new Date(i.createdAt).getTime() : NaN;
      if (Number.isNaN(t) || (from && t < from) || (to && t > to)) return false;
    }
    return true;
  });
}

async function loadIncidents() {
  const f = readFilters();
  if (f.from && f.to && f.from > f.to) {
    rangeError.textContent = 'La fecha inicial no puede ser posterior a la final.';
    return;
  }
  rangeError.textContent = '';
  const myRequest = ++state.requestId;
  table.setLoading('Cargando incidentes...');
  try {
    const list = await incidentsApi.list(f);
    if (myRequest !== state.requestId) return; // respuesta obsoleta
    table.setRows(applyClientFilters(list, f));
  } catch (err) {
    if (myRequest !== state.requestId) return;
    table.setError(err.message);
    toast.error(err.message);
  }
}

function fillSelect(select, items, getValue, getLabel) {
  items.forEach((item) => select.append(el('option', { value: getValue(item), text: getLabel(item) })));
}

function initFilters() {
  fillSelect(qs('#f-status'), Object.entries(INCIDENT_STATUS), ([k]) => k, ([, v]) => v.label);
  fillSelect(qs('#f-priority'), Object.entries(INCIDENT_PRIORITY), ([k]) => k, ([, v]) => v.label);
  const reload = debounce(loadIncidents, 350);
  qs('#f-search').addEventListener('input', reload);
  filtersForm.querySelectorAll('select, input[type=date]').forEach((n) => n.addEventListener('change', loadIncidents));
  filtersForm.addEventListener('submit', (e) => { e.preventDefault(); loadIncidents(); });
  qs('#btn-clear').addEventListener('click', () => { filtersForm.reset(); loadIncidents(); });
}

async function loadCatalogs() {
  const [cats, users] = await Promise.allSettled([catalogsApi.categories(), catalogsApi.users()]);
  if (cats.status === 'fulfilled') {
    state.categories = cats.value;
    fillSelect(qs('#f-category'), state.categories, (c) => c.id, (c) => c.name);
  } else toast.warning(`No se pudieron cargar las categorías: ${cats.reason.message}`);
  if (users.status === 'fulfilled') state.users = users.value;
  else toast.warning(`No se pudieron cargar los usuarios: ${users.reason.message}`);
}

/* ---------- Crear incidente ---------- */
function field({ id, name, label, control, required = false, hint, span2 = false }) {
  return el('div', { class: `form-group ${span2 ? 'span-2' : ''}` }, [
    el('label', { class: 'form-label', for: id }, [label, required ? el('span', { class: 'req', 'aria-hidden': 'true', text: '*' }) : null]),
    control,
    hint ? el('span', { class: 'form-hint', text: hint }) : null,
    el('span', { class: 'form-error', id: `${id}-error`, role: 'alert' }),
  ]);
}

function openCreateModal() {
  const priorityOptions = Object.entries(INCIDENT_PRIORITY).map(([k, v]) => el('option', { value: k, text: v.label }));
  const form = el('form', { id: 'incident-form', class: 'form-grid', novalidate: true }, [
    field({ id: 'i-title', label: 'Título', required: true, span2: true, control: el('input', { class: 'input', id: 'i-title', name: 'title', maxlength: '150', placeholder: 'Ej. No hay conexión a la red de la oficina', 'aria-describedby': 'i-title-error' }) }),
    field({ id: 'i-description', label: 'Descripción', required: true, span2: true, hint: 'Describa síntomas, equipo afectado y mensajes de error.', control: el('textarea', { class: 'textarea', id: 'i-description', name: 'description', maxlength: '2000', 'aria-describedby': 'i-description-error' }) }),
    field({ id: 'i-category', label: 'Categoría', required: true, control: el('select', { class: 'select', id: 'i-category', name: 'categoryId' }, [el('option', { value: '', text: 'Seleccione...' }), ...state.categories.map((c) => el('option', { value: c.id, text: c.name }))]) }),
    field({ id: 'i-priority', label: 'Prioridad', required: true, control: el('select', { class: 'select', id: 'i-priority', name: 'priority' }, [el('option', { value: '', text: 'Seleccione...' }), ...priorityOptions]) }),
    field({ id: 'i-assigned', label: 'Asignar a (opcional)', span2: true, control: el('select', { class: 'select', id: 'i-assigned', name: 'assignedTo' }, [el('option', { value: '', text: 'Sin asignar' }), ...state.users.map((u) => el('option', { value: u.id, text: u.name }))]) }),
  ]);

  const schema = {
    title: [rules.required('El título es obligatorio'), rules.minLength(5, 'El título debe tener al menos 5 caracteres'), rules.maxLength(150)],
    description: [rules.required('La descripción es obligatoria'), rules.minLength(10, 'Describa el problema con al menos 10 caracteres'), rules.maxLength(2000)],
    categoryId: [rules.required('Seleccione una categoría')],
    priority: [rules.required('Seleccione una prioridad'), rules.oneOf(Object.keys(INCIDENT_PRIORITY))],
  };
  bindLiveValidation(form, schema);

  const submit = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Crear incidente', form: 'incident-form' });
  const cancel = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Cancelar' });
  const modal = openModal({ title: 'Nuevo incidente', body: form, footer: [cancel, submit] });
  cancel.addEventListener('click', () => modal.close());

  if (!state.categories.length) toast.warning('No hay categorías disponibles; no se podrá crear el incidente hasta que el catálogo cargue.');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { valid, values } = validateForm(form, schema);
    if (!valid) return;
    setLoading(submit, true);
    try {
      const created = await incidentsApi.create({ ...values, assignedTo: form.elements.assignedTo.value });
      toast.success(`Incidente #${created.id ?? ''} creado correctamente.`);
      modal.close('saved');
      loadIncidents();
    } catch (err) {
      // Errores de validacion del servidor, si vienen por campo
      const details = err.details;
      if (details && typeof details === 'object') {
        const entries = Array.isArray(details) ? details.map((d) => [d.field || d.path, d.message || d.msg]) : Object.entries(details);
        const map = { category_id: 'categoryId' };
        entries.forEach(([k, msg]) => { const f = form.elements[map[k] || k]; if (f && msg) setFieldError(f, String(msg)); });
      }
      toast.error(err.message);
    } finally {
      setLoading(submit, false);
    }
  });
}

/* ---------- Detalle ---------- */
async function openDetail(id) {
  const body = el('div', {}, [el('div', { class: 'loading-state', role: 'status' }, [el('div', { class: 'spinner' }), el('span', { text: 'Cargando detalle...' })])]);
  const closeBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Cerrar' });
  const modal = openModal({ title: `Incidente #${id}`, body, footer: [closeBtn], size: 'lg' });
  closeBtn.addEventListener('click', () => modal.close());
  try {
    const i = await incidentsApi.get(id);
    const dl = el('dl', { class: 'detail-list' }, [
      el('dt', { text: 'Título' }), el('dd', { text: orDash(i.title) }),
      el('dt', { text: 'Descripción' }), el('dd', { text: orDash(i.description) }),
      el('dt', { text: 'Categoría' }), el('dd', { text: orDash(i.category) }),
      el('dt', { text: 'Prioridad' }), el('dd', {}, [priorityBadge(i.priority)]),
      el('dt', { text: 'Estado' }), el('dd', {}, [statusBadge(i.status)]),
      el('dt', { text: 'Asignado a' }), el('dd', { text: orDash(i.assignedTo) }),
      el('dt', { text: 'Creado' }), el('dd', { text: formatDateTime(i.createdAt) }),
      el('dt', { text: 'Actualizado' }), el('dd', { text: formatDateTime(i.updatedAt) }),
    ]);
    body.replaceChildren(dl);
  } catch (err) {
    body.replaceChildren(el('div', { class: 'alert alert--danger', role: 'alert', text: err.message }));
  }
}

/* ---------- Cambio de estado ---------- */
function openStatusModal(incident) {
  const select = el('select', { class: 'select', id: 's-status', name: 'status' },
    Object.entries(INCIDENT_STATUS).map(([k, v]) => el('option', { value: k, text: v.label, selected: k === incident.status })));
  const body = el('div', { class: 'stack' }, [
    el('p', { text: `Incidente #${incident.id}: ${incident.title}` }),
    el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 's-status', text: 'Nuevo estado' }), select]),
  ]);
  const cancel = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Cancelar' });
  const save = el('button', { type: 'button', class: 'btn btn-primary', text: 'Guardar estado' });
  const modal = openModal({ title: 'Cambiar estado', body, footer: [cancel, save], size: 'sm' });
  cancel.addEventListener('click', () => modal.close());
  save.addEventListener('click', async () => {
    if (select.value === incident.status) { toast.info('El incidente ya tiene ese estado.'); return; }
    const label = INCIDENT_STATUS[select.value]?.label || select.value;
    const ok = await confirmDialog({ title: 'Confirmar cambio de estado', message: `¿Cambiar el incidente #${incident.id} a "${label}"?`, confirmText: 'Sí, cambiar' });
    if (!ok) return;
    setLoading(save, true);
    try {
      await incidentsApi.updateStatus(incident.id, select.value);
      toast.success(`Estado actualizado a "${label}".`);
      modal.close('saved');
      loadIncidents();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(save, false);
    }
  });
}

/* ---------- Inicio ---------- */
initNavbar();
initFilters();
qs('#btn-new').addEventListener('click', openCreateModal);
loadCatalogs().then(loadIncidents);
