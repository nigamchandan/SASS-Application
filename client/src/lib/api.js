import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const TOKEN_STORAGE_KEY = 'sass_app_token';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export const checkHealth = async () => {
  const { data } = await api.get('/health');
  return data;
};

export function downloadBlob(blob, filename, fallbackType = 'application/octet-stream') {
  const finalBlob =
    blob instanceof Blob ? blob : new Blob([blob], { type: fallbackType });
  const url = window.URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const authApi = {
  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },
  login: async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    return data;
  },
  me: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

export const customersApi = {
  list: async (params = {}) => {
    const { data } = await api.get('/customers', { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post('/customers', payload);
    return data;
  },
  getById: async (id) => {
    const { data } = await api.get(`/customers/${id}`);
    return data;
  },
  summary: async (id) => {
    const { data } = await api.get(`/customers/${id}/summary`);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.patch(`/customers/${id}`, payload);
    return data;
  },
  remove: async (id) => {
    const { data } = await api.delete(`/customers/${id}`);
    return data;
  },
  exportCsv: async (params = {}) => {
    const res = await api.get('/customers/export.csv', {
      params,
      responseType: 'blob',
    });
    return res;
  },
  exportPdf: async (params = {}) => {
    const res = await api.get('/customers/export.pdf', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export const invoicesApi = {
  list: async (params = {}) => {
    const { data } = await api.get('/invoices', { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post('/invoices', payload);
    return data;
  },
  getOne: async (id) => {
    const { data } = await api.get(`/invoices/${id}`);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/invoices/${id}`, payload);
    return data;
  },
  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/invoices/${id}/status`, { status });
    return data;
  },
  remove: async (id) => {
    const { data } = await api.delete(`/invoices/${id}`);
    return data;
  },
  pdfUrl: (id) =>
    `${api.defaults.baseURL}/invoices/${id}/pdf`,
  downloadPdf: async (id, suggestedFilename) => {
    const response = await api.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFilename || 'invoice.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  exportCsv: async (params = {}) => {
    const res = await api.get('/invoices/export.csv', {
      params,
      responseType: 'blob',
    });
    return res;
  },
  exportPdf: async (params = {}) => {
    const res = await api.get('/invoices/export.pdf', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export const paymentsApi = {
  list: async (invoiceId) => {
    const { data } = await api.get(`/invoices/${invoiceId}/payments`);
    return data;
  },
  add: async (invoiceId, payload) => {
    const { data } = await api.post(`/invoices/${invoiceId}/payments`, payload);
    return data;
  },
  remove: async (invoiceId, paymentId) => {
    const { data } = await api.delete(
      `/invoices/${invoiceId}/payments/${paymentId}`
    );
    return data;
  },
  listAll: async (params = {}) => {
    const { data } = await api.get('/payments', { params });
    return data;
  },
  summary: async (params = {}) => {
    const { data } = await api.get('/payments/summary', { params });
    return data;
  },
  removeById: async (paymentId) => {
    const { data } = await api.delete(`/payments/${paymentId}`);
    return data;
  },
  exportCsv: async (params = {}) => {
    const res = await api.get('/payments/export.csv', {
      params,
      responseType: 'blob',
    });
    return res;
  },
  exportPdf: async (params = {}) => {
    const res = await api.get('/payments/export.pdf', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export const dashboardApi = {
  stats: async () => {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },
  summary: async (params = {}) => {
    const { data } = await api.get('/dashboard/summary', { params });
    return data;
  },
  revenue: async (params = {}) => {
    const { data } = await api.get('/dashboard/revenue', { params });
    return data;
  },
  recentInvoices: async (params = {}) => {
    const { data } = await api.get('/dashboard/recent-invoices', { params });
    return data;
  },
  invoiceStatus: async () => {
    const { data } = await api.get('/dashboard/invoice-status');
    return data;
  },
  topCustomers: async (params = {}) => {
    const { data } = await api.get('/dashboard/top-customers', { params });
    return data;
  },
  activity: async (params = {}) => {
    const { data } = await api.get('/dashboard/activity', { params });
    return data;
  },
  alerts: async (params = {}) => {
    const { data } = await api.get('/dashboard/alerts', { params });
    return data;
  },
};

export const whatsappApi = {
  preview: async (invoiceId) => {
    const { data } = await api.get(`/invoices/${invoiceId}/whatsapp/preview`);
    return data;
  },
  list: async (invoiceId) => {
    const { data } = await api.get(`/invoices/${invoiceId}/whatsapp/messages`);
    return data;
  },
  sendInvoice: async (invoiceId, payload = {}) => {
    const { data } = await api.post(
      `/invoices/${invoiceId}/whatsapp/send-invoice`,
      payload
    );
    return data;
  },
  sendReminder: async (invoiceId, payload = {}) => {
    const { data } = await api.post(
      `/invoices/${invoiceId}/whatsapp/send-reminder`,
      payload
    );
    return data;
  },
  listAll: async (params = {}) => {
    const { data } = await api.get('/whatsapp/messages', { params });
    return data;
  },
  summary: async (params = {}) => {
    const { data } = await api.get('/whatsapp/summary', { params });
    return data;
  },
  exportCsv: async (params = {}) => {
    const res = await api.get('/whatsapp/export.csv', {
      params,
      responseType: 'blob',
    });
    return res;
  },
  exportPdf: async (params = {}) => {
    const res = await api.get('/whatsapp/export.pdf', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export const expensesApi = {
  list: async (params = {}) => {
    const { data } = await api.get('/expenses', { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post('/expenses', payload);
    return data;
  },
  getOne: async (id) => {
    const { data } = await api.get(`/expenses/${id}`);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.patch(`/expenses/${id}`, payload);
    return data;
  },
  remove: async (id) => {
    const { data } = await api.delete(`/expenses/${id}`);
    return data;
  },
  summary: async (params = {}) => {
    const { data } = await api.get('/expenses/summary', { params });
    return data;
  },
  exportCsv: async (params = {}) => {
    const res = await api.get('/expenses/export.csv', {
      params,
      responseType: 'blob',
    });
    return res;
  },
  exportPdf: async (params = {}) => {
    const res = await api.get('/expenses/export.pdf', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export const reportsApi = {
  summary: async (params = {}) => {
    const { data } = await api.get('/reports/summary', { params });
    return data;
  },
  exportCsvUrl: (params = {}) => {
    const search = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    const base = api.defaults.baseURL || '/api';
    return `${base}/reports/export.csv${search ? `?${search}` : ''}`;
  },
  exportCsv: async (params = {}) => {
    const res = await api.get('/reports/export.csv', {
      params,
      responseType: 'blob',
    });
    return res;
  },
  exportPdfUrl: (params = {}) => {
    const search = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    const base = api.defaults.baseURL || '/api';
    return `${base}/reports/export.pdf${search ? `?${search}` : ''}`;
  },
  exportPdf: async (params = {}) => {
    const res = await api.get('/reports/export.pdf', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export const settingsApi = {
  get: async () => {
    const { data } = await api.get('/settings');
    return data;
  },
  updateProfile: async (payload) => {
    const { data } = await api.put('/settings/profile', payload);
    return data;
  },
  updateInvoice: async (payload) => {
    const { data } = await api.put('/settings/invoice', payload);
    return data;
  },
  uploadLogo: async (file) => {
    const form = new FormData();
    form.append('logo', file);
    const { data } = await api.post('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  removeLogo: async () => {
    const { data } = await api.delete('/settings/logo');
    return data;
  },
  changePassword: async (payload) => {
    const { data } = await api.post('/settings/password', payload);
    return data;
  },
};

export const extractApiError = (error, fallback = 'Something went wrong') => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};
