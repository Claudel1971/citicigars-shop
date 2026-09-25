const TOKEN_KEY = "citicigars-admin-token";

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string, persist = false) {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  (persist ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("citicigars-auth-expired"));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers, credentials: "include" });
  if (response.status === 401) {
    clearAdminToken();
    throw new Error("AUTH_REQUIRED");
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.error || body?.message || detail;
    } catch {}
    throw new Error(detail || `HTTP_${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function login(password: string, persist = false) {
  const session = await request<{ token: string; expiresInSeconds: number }>("/api/content/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  setAdminToken(session.token, persist);
  return session;
}

export const api = {
  customers: (search = "") => request<any[]>(`/api/crm/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  customer: (id: string) => request<any>(`/api/crm/customers/${encodeURIComponent(id)}`),
  stock: (search = "") => request<any>(`/api/admin/stock${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  suppliers: () => request<{ suppliers: any[] }>("/api/admin/purchasing/suppliers"),
  purchaseOrders: () => request<{ orders: any[] }>("/api/admin/purchasing/orders"),
  receipts: () => request<{ receipts: any[] }>("/api/admin/purchasing/receipts"),
  followups: () => request<any[]>("/api/crm/followups?status=OPEN"),
};
