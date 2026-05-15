import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// ── RFQ / Email ──────────────────────────────────────────────
export const triggerMailFetch   = ()     => api.post('/mail/fetch');
export const getRFQs            = ()     => api.get('/rfqs');
export const getRFQ             = (id)   => api.get(`/rfqs/${id}`);

// ── Quotes ───────────────────────────────────────────────────
export const getQuotes          = ()     => api.get('/quotes');
export const getQuote           = (id)   => api.get(`/quotes/${id}`);
export const generateQuote      = (rfqId)=> api.post(`/quotes/generate/${rfqId}`);
export const sendQuote          = (id)   => api.post(`/quotes/${id}/send`);
export const downloadQuotePDF   = (id)   => api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });

// ── Pricing DB ───────────────────────────────────────────────
export const getParts           = ()              => api.get('/parts');
export const createPart         = (data)          => api.post('/parts', data);
export const updatePart         = (id, data)      => api.put(`/parts/${id}`, data);
export const deletePart         = (id)            => api.delete(`/parts/${id}`);

// ── Stats for dashboard ──────────────────────────────────────
export const getStats           = ()     => api.get('/stats');

export default api;
