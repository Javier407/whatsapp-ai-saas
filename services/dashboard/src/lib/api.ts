const BASE = "/api/v1";

function getToken() {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "Request failed");
  return body.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type LoginResponse = { token: string; tenant_id: string; expires_at: string };

export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};

// ── Tenant ────────────────────────────────────────────────────────────────────

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  waba_id: string | null;
  phone_number_id: string | null;
};

export const tenant = {
  get: () => request<Tenant>("/tenant"),
  update: (data: { name?: string }) =>
    request<Tenant>("/tenant", { method: "PATCH", body: JSON.stringify(data) }),
  connectWhatsApp: (data: {
    waba_id: string;
    phone_number_id: string;
    access_token: string;
  }) =>
    request<{ connected: boolean }>("/tenant/whatsapp/connect", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Flows ─────────────────────────────────────────────────────────────────────

export type Flow = {
  id: string;
  name: string;
  description: string | null;
  trigger: Record<string, unknown>;
  entry_node: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export const flows = {
  list: () => request<Flow[]>("/flows"),
  get: (id: string) => request<Flow>(`/flows/${id}`),
  create: (data: unknown) =>
    request<Flow>("/flows", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request<Flow>(`/flows/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  activate: (id: string) =>
    request<Flow>(`/flows/${id}/activate`, { method: "POST" }),
  delete: (id: string) =>
    request<void>(`/flows/${id}`, { method: "DELETE" }),
};

// ── Knowledge Base ────────────────────────────────────────────────────────────

export type KbDocument = {
  id: string;
  name: string;
  source_type: string;
  status: "pending" | "indexing" | "indexed" | "failed";
  chunk_count: number | null;
  error_message: string | null;
  uploaded_at: string;
  indexed_at: string | null;
};

export const kb = {
  list: () => request<KbDocument[]>("/kb/documents"),
  upload: (file: File, sourceType: string) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    form.append("source_type", sourceType);
    return fetch(`${BASE}/kb/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
      return body.data as KbDocument;
    });
  },
  delete: (id: string) => request<void>(`/kb/documents/${id}`, { method: "DELETE" }),
};

// ── Conversations ─────────────────────────────────────────────────────────────

export type ConversationLog = {
  id: string;
  wa_id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  content: Record<string, unknown>;
  flow_id: string | null;
  node_key: string | null;
  llm_tokens: number | null;
  latency_ms: number | null;
  created_at: string;
};

export const conversations = {
  list: (params?: { wa_id?: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.wa_id) qs.set("wa_id", params.wa_id);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<ConversationLog[]>(`/conversations?${qs}`);
  },
};

// ── Dry-run ───────────────────────────────────────────────────────────────────

export type DryRunResult = {
  reply: string;
  flow_id: string | null;
  trace: unknown[];
};

export const dryRun = (message: string, simulated_wa_id = "test-preview") =>
  request<DryRunResult>("/dry-run", {
    method: "POST",
    body: JSON.stringify({ message, simulated_wa_id }),
  });
