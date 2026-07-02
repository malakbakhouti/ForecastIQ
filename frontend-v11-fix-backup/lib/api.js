// lib/api.js — Client API centralisé pour ForecastIQ
// Toutes les requêtes vers le backend Flask passent par ici.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

// ---- Gestion du token JWT (localStorage) ----
const TOKEN_KEY = "forecastiq_token";
const USER_KEY = "forecastiq_user";

export function saveAuth(token, user) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ---- Wrapper fetch ----
async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload = body;
  if (body && !isForm) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });

  if (res.status === 401 && typeof window !== "undefined") {
    clearAuth();
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Erreur ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- API ----
export const api = {
  register: (email, password, full_name) =>
    request("/api/auth/register", { method: "POST", body: { email, password, full_name } }),

  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),

  me: () => request("/api/auth/me"),

  logout: () => request("/api/auth/logout", { method: "POST" }),

  changePassword: (old_password, new_password) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: { old_password, new_password },
    }),

  listDatasets: () => request("/api/datasets"),

  getDataset: (id) => request(`/api/datasets/${id}`),

  previewDataset: (id) => request(`/api/datasets/${id}/preview`),

  uploadDataset: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/api/datasets/upload", { method: "POST", body: form, isForm: true });
  },

  updateMapping: (id, mapping) =>
    request(`/api/datasets/${id}/mapping`, { method: "PUT", body: mapping }),

  deleteDataset: (id) => request(`/api/datasets/${id}`, { method: "DELETE" }),

  getDashboard: (id, { granularity = "monthly", horizon = 6, category } = {}) => {
    const params = new URLSearchParams({ granularity, horizon: String(horizon) });
    if (category) params.set("category", category);
    return request(`/api/datasets/${id}/dashboard?${params}`);
  },

  predictSample: (datasetId, file, granularity = "monthly") => {
    const form = new FormData();
    form.append("file", file);
    form.append("granularity", granularity);
    return request(`/api/datasets/${datasetId}/predict-sample`, {
      method: "POST",
      body: form,
      isForm: true,
    });
  },

  runForecast: (dataset_id, opts = {}) =>
    request("/api/forecasts/run", { method: "POST", body: { dataset_id, ...opts } }),

  getForecast: (id) => request(`/api/forecasts/${id}`),

  listForecasts: (datasetId) => request(`/api/datasets/${datasetId}/forecasts`),

  health: () => request("/api/health"),
};

export { API_BASE };
