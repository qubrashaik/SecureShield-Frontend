const BASE_URL = "http://localhost:8080";

function getToken() {
  return localStorage.getItem("ss_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (username, email, password) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),

  login: (username, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  scan: (payload) =>
    request("/api/scan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  history: () => request("/api/scan/history"),

  setToken: (token) => localStorage.setItem("ss_token", token),
  clearToken: () => localStorage.removeItem("ss_token"),
  isAuthed: () => !!getToken(),
};
