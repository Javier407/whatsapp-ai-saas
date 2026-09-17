const BASE = "/api/v1";

function getToken() {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      // Only declare a JSON body when one is actually sent. Fastify rejects
      // requests that set Content-Type: application/json with an empty body
      // (e.g. DELETE, or POST actions with no payload) with a 400.
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  // 204 No Content (e.g. successful DELETE) has no body to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "Request failed");
  return body.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type LoginResponse = { token: string; tenant_id: string; expires_at: string };

export const auth = {
  login: (email: string, password: string, tenantSlug: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, tenant_slug: tenantSlug }),
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
  whatsapp: {
    connected: boolean;
    waba_id: string | null;
    phone_number_id: string | null;
  } | null;
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

export type FlowNodeDto = {
  id: string;
  node_key: string;
  type:
    | "message"
    | "interactive"
    | "collect_input"
    | "condition"
    | "rag_lookup"
    | "llm_generate"
    | "api_call"
    | "book_appointment"
    | "end";
  config: Record<string, unknown>;
  transitions: Array<{ next: string; condition?: string }>;
  meta: { position?: { x: number; y: number } } & Record<string, unknown>;
};

export type FlowWithNodes = Flow & { nodes: FlowNodeDto[] };

export type UpdateFlowDto = {
  name?: string;
  description?: string;
  trigger?: Record<string, unknown>;
  entry_node?: string;
  nodes?: Array<{
    node_key: string;
    type: FlowNodeDto["type"];
    config: Record<string, unknown>;
    transitions: Array<{ next: string; condition?: string }>;
    meta?: Record<string, unknown>;
  }>;
};

export const flows = {
  list: () => request<Flow[]>("/flows"),
  get: (id: string) => request<FlowWithNodes>(`/flows/${id}`),
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
    // Text fields MUST come before the file part: the backend reads them from
    // the multipart stream via request.file(), and fields after the file are
    // not yet parsed. The backend also requires a `name` field.
    form.append("name", file.name);
    form.append("source_type", sourceType);
    form.append("file", file);
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

export type SessionState = { state: string | null; handoff: boolean };

export const conversations = {
  list: (params?: { wa_id?: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.wa_id) qs.set("wa_id", params.wa_id);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.limit) qs.set("limit", String(params.limit));
    // The route returns the list directly; request() already unwraps `data`.
    return request<ConversationLog[]>(`/conversations?${qs}`);
  },
  getState: (waId: string) =>
    request<SessionState>(`/conversations/${encodeURIComponent(waId)}/state`),
  reply: (waId: string, message: string) =>
    request<{ status: string }>(`/conversations/${encodeURIComponent(waId)}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  resume: (waId: string) =>
    request<{ status: string }>(`/conversations/${encodeURIComponent(waId)}/resume`, {
      method: "POST",
    }),
  takeover: (waId: string) =>
    request<{ status: string }>(`/conversations/${encodeURIComponent(waId)}/takeover`, {
      method: "POST",
    }),
};

// ── Appointments ──────────────────────────────────────────────────────────────

export type Appointment = {
  id: string;
  wa_id: string;
  customer_name: string | null;
  service: string | null;
  appointment_date: string | null;
  status: string;
  created_at: string;
};

export const appointments = {
  list: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<Appointment[]>(`/appointments?${qs}`);
  },
  updateStatus: (id: string, status: string) =>
    request<Appointment>(`/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// ── Dry-run ───────────────────────────────────────────────────────────────────

export type DryRunResult = {
  reply: string;
  session_state: string;
  sent: { type: string; to: string; text?: string }[];
};

// flow-engine returns { session_state, current_node, slots, sent: [...] };
// flatten the sent messages into a single reply string for display.
export const dryRun = (message: string, simulated_wa_id = "test-preview") =>
  request<{
    session_state: string;
    current_node: string | null;
    slots: Record<string, unknown>;
    sent: { type: string; to: string; text?: string }[];
  }>("/dry-run", {
    method: "POST",
    body: JSON.stringify({ message, simulated_wa_id }),
  }).then((r) => ({
    reply:
      r.sent.map((s) => s.text).filter(Boolean).join("\n\n") ||
      "(sin respuesta)",
    session_state: r.session_state,
    sent: r.sent,
  }));
