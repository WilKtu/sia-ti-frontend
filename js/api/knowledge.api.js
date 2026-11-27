/**
 * API de base de conocimiento.
 *
 * CONTRATO PROVISIONAL (pendiente de confirmar con el backend, W-05/D):
 *   GET   /api/knowledge?search          lista de articulos
 *   GET   /api/knowledge/:id
 *   POST  /api/knowledge                 { title, problem, symptoms, cause, solution, category_id }
 *   PUT   /api/knowledge/:id             (mismos campos)
 *   PATCH /api/knowledge/:id/active      { active: boolean }
 *   PATCH /api/knowledge/:id/verify      { verified: boolean }
 *   POST  /api/knowledge/reindex         (el backend orquesta n8n; el front NUNCA llama a n8n)
 * Solo activo + verificado => elegible como fuente (regla aplicada por backend).
 */
import { api, unwrap, unwrapList } from './client.js';

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return null;
};
const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true';

export function normalizeArticle(raw = {}) {
  const category = pick(raw, 'category', 'categoria', 'category_name', 'categoria_nombre');
  return {
    id: pick(raw, 'id', 'article_id', 'articulo_id'),
    title: pick(raw, 'title', 'titulo') ?? '',
    problem: pick(raw, 'problem', 'problema') ?? '',
    symptoms: pick(raw, 'symptoms', 'sintomas') ?? '',
    cause: pick(raw, 'cause', 'causa') ?? '',
    solution: pick(raw, 'solution', 'solucion') ?? '',
    categoryId: pick(raw, 'category_id', 'categoria_id') ?? (category && typeof category === 'object' ? category.id : null),
    category: category && typeof category === 'object' ? category.name ?? category.nombre ?? '' : category ?? '',
    active: toBool(pick(raw, 'is_active', 'active', 'activo')),
    verified: toBool(pick(raw, 'is_verified', 'verified', 'verificado')),
    updatedAt: pick(raw, 'updated_at', 'updatedAt', 'fecha_actualizacion', 'created_at'),
  };
}

const toPayload = (a) => ({
  title: a.title,
  problem: a.problem,
  symptoms: a.symptoms,
  cause: a.cause,
  solution: a.solution,
  category_id: Number(a.categoryId) || a.categoryId,
});

export const knowledgeApi = {
  async list({ search } = {}) {
    return unwrapList(await api.get('/api/knowledge', { params: { search } })).map(normalizeArticle);
  },
  async get(id) {
    return normalizeArticle(unwrap(await api.get(`/api/knowledge/${encodeURIComponent(id)}`)));
  },
  async create(article) {
    return normalizeArticle(unwrap(await api.post('/api/knowledge', toPayload(article))));
  },
  async update(id, article) {
    return normalizeArticle(unwrap(await api.put(`/api/knowledge/${encodeURIComponent(id)}`, toPayload(article))));
  },
  setActive(id, active) {
    return api.patch(`/api/knowledge/${encodeURIComponent(id)}/active`, { active });
  },
  setVerified(id, verified) {
    return api.patch(`/api/knowledge/${encodeURIComponent(id)}/verify`, { verified });
  },
  reindex() {
    return api.post('/api/knowledge/reindex', {});
  },
};
