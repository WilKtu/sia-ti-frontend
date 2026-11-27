/**
 * API de incidentes y catalogos.
 *
 * CONTRATO PROVISIONAL (pendiente de confirmar con el backend de D):
 *   GET   /api/incidents?search&status&category_id&priority&from&to
 *   GET   /api/incidents/:id
 *   POST  /api/incidents            { title, description, category_id, priority, assigned_to? }
 *   PATCH /api/incidents/:id/status { status }
 *   GET   /api/categories           (W-04)
 *   GET   /api/users                (W-04)
 * Si el backend usa otros nombres, solo hay que ajustar este archivo
 * (rutas y funcion normalizeIncident).
 */
import { api, unwrap, unwrapList } from './client.js';

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return null;
};

/** Convierte un incidente del servidor a la forma que usa la UI. */
export function normalizeIncident(raw = {}) {
  const category = pick(raw, 'category', 'categoria', 'category_name', 'categoria_nombre');
  const assigned = pick(raw, 'assigned_user', 'assigned_to_name', 'usuario_asignado', 'assigned_to', 'asignado');
  return {
    id: pick(raw, 'id', 'incident_id', 'incidente_id'),
    title: pick(raw, 'title', 'titulo') ?? '',
    description: pick(raw, 'description', 'descripcion') ?? '',
    categoryId: pick(raw, 'category_id', 'categoria_id') ?? (category && typeof category === 'object' ? category.id : null),
    category: category && typeof category === 'object' ? category.name ?? category.nombre ?? '' : category ?? '',
    priority: String(pick(raw, 'priority', 'prioridad') ?? '').toLowerCase(),
    status: String(pick(raw, 'status', 'estado') ?? '').toLowerCase(),
    assignedTo: assigned && typeof assigned === 'object' ? assigned.name ?? assigned.nombre ?? assigned.email ?? '' : assigned ?? '',
    createdAt: pick(raw, 'created_at', 'createdAt', 'fecha_creacion', 'fecha'),
    updatedAt: pick(raw, 'updated_at', 'updatedAt', 'fecha_actualizacion'),
  };
}

export const incidentsApi = {
  async list(filters = {}) {
    const params = {
      search: filters.search,
      status: filters.status,
      category_id: filters.categoryId,
      priority: filters.priority,
      from: filters.from,
      to: filters.to,
    };
    return unwrapList(await api.get('/api/incidents', { params })).map(normalizeIncident);
  },

  async get(id) {
    return normalizeIncident(unwrap(await api.get(`/api/incidents/${encodeURIComponent(id)}`)));
  },

  async create({ title, description, categoryId, priority, assignedTo }) {
    const body = { title, description, category_id: Number(categoryId) || categoryId, priority };
    if (assignedTo) body.assigned_to = Number(assignedTo) || assignedTo;
    return normalizeIncident(unwrap(await api.post('/api/incidents', body)));
  },

  async updateStatus(id, status) {
    return unwrap(await api.patch(`/api/incidents/${encodeURIComponent(id)}/status`, { status }));
  },
};

export const catalogsApi = {
  async categories() {
    return unwrapList(await api.get('/api/categories')).map((c) => ({
      id: pick(c, 'id', 'category_id'),
      name: pick(c, 'name', 'nombre') ?? '',
    }));
  },
  async users() {
    return unwrapList(await api.get('/api/users')).map((u) => ({
      id: pick(u, 'id', 'user_id'),
      name: pick(u, 'name', 'nombre', 'full_name', 'email') ?? '',
    }));
  },
};
