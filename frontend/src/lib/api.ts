const API_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : import.meta.env.DEV
      ? 'http://localhost:8000/api'
      : '/api';

const TOKEN_KEY = 'askora_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) detail = typeof data.detail === 'string' ? data.detail : detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Types mirrored from the backend ----
export interface ApiUser {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'user';
  status: string;
  auth_provider: string;
  avatar_url: string | null;
  usage_minutes: number;
  last_login: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: ApiUser;
}

export interface ApiChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface ApiChatSession {
  id: string;
  title: string;
  video_name: string | null;
  video_id: string | null;
  transcript_id: string | null;
  step: number;
  created_at: string;
  updated_at: string;
  messages: ApiChatMessage[];
}

export interface ApiVideo {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  size_mb: number;
  status: string;
  created_at: string;
  last_accessed: string | null;
}

export interface ApiComplaint {
  id: string;
  ticket_id: string;
  user_id: string;
  title: string;
  category: string;
  priority: string;
  description: string;
  screenshot_url: string | null;
  status: string;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ApiAlert {
  id: string;
  alert_code: string;
  alert_type: string;
  user_id: string | null;
  user_name: string | null;
  message: string;
  priority: string;
  status: string;
  admin_notes: string | null;
  is_read: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface AnalyticsSummary {
  total_users: number;
  active_users: number;
  inactive_users: number;
  blocked_users: number;
  open_alerts: number;
  total_complaints: number;
  total_videos: number;
  total_chats: number;
  avg_usage_minutes: number;
}

// ---- Display helpers ----
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatUsageMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function titleCaseStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function toApiPriority(priority: string): string {
  return priority.toLowerCase();
}

export const api = {
  signup: (full_name: string, email: string, password: string, auth_provider = 'local') =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      auth: false,
      body: { full_name, email, password, auth_provider },
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    }),
  me: () => request<ApiUser>('/auth/me'),
  updateMe: (body: { full_name?: string; avatar_url?: string }) =>
    request<ApiUser>('/users/me', { method: 'PATCH', body }),

  listUsers: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status.toLowerCase());
    const q = params.toString();
    return request<ApiUser[]>(`/users${q ? `?${q}` : ''}`);
  },
  setUserStatus: (userId: string, status: string) =>
    request<ApiUser>(`/users/${userId}/status`, { method: 'PATCH', body: { status } }),
  deleteUser: (userId: string) => request<{ detail: string }>(`/users/${userId}`, { method: 'DELETE' }),

  listChats: () => request<ApiChatSession[]>('/chats'),
  getChat: (sessionId: string) => request<ApiChatSession>(`/chats/${sessionId}`),
  createChat: (body: {
    title?: string;
    video_name?: string | null;
    video_id?: string | null;
    transcript_id?: string | null;
    step?: number;
    messages?: { role: string; content: string }[];
  }) => request<ApiChatSession>('/chats', { method: 'POST', body }),
  updateChat: (
    sessionId: string,
    body: {
      title?: string;
      video_name?: string | null;
      video_id?: string | null;
      transcript_id?: string | null;
      step?: number;
      messages?: { role: string; content: string }[];
    },
  ) => request<ApiChatSession>(`/chats/${sessionId}`, { method: 'PUT', body }),
  deleteChat: (sessionId: string) =>
    request<{ detail: string }>(`/chats/${sessionId}`, { method: 'DELETE' }),

  listVideos: (status?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status.toLowerCase());
    const q = params.toString();
    return request<ApiVideo[]>(`/videos${q ? `?${q}` : ''}`);
  },
  createVideo: (body: {
    title: string;
    subject?: string | null;
    duration_seconds?: number;
    size_mb?: number;
    status?: string;
  }) => request<ApiVideo>('/videos', { method: 'POST', body }),
  updateVideo: (
    videoId: string,
    body: { title?: string; status?: string; duration_seconds?: number; last_accessed?: string },
  ) => request<ApiVideo>(`/videos/${videoId}`, { method: 'PATCH', body }),
  markVideoAccessed: (videoId: string) =>
    request<ApiVideo>(`/videos/${videoId}/access`, { method: 'POST' }),
  deleteVideo: (videoId: string) =>
    request<{ detail: string }>(`/videos/${videoId}`, { method: 'DELETE' }),

  listComplaints: () => request<ApiComplaint[]>('/complaints'),
  createComplaint: (body: {
    title: string;
    category: string;
    priority: string;
    description: string;
    screenshot_url?: string | null;
  }) => request<ApiComplaint>('/complaints', { method: 'POST', body }),
  updateComplaint: (
    complaintId: string,
    body: { status?: string; admin_response?: string; priority?: string },
  ) => request<ApiComplaint>(`/complaints/${complaintId}`, { method: 'PATCH', body }),

  listAlerts: (alertType?: string, status?: string) => {
    const params = new URLSearchParams();
    if (alertType && alertType !== 'all') params.set('alert_type', alertType);
    if (status && status !== 'all') params.set('status', status.toLowerCase().replace(/ /g, '_'));
    const q = params.toString();
    return request<ApiAlert[]>(`/alerts${q ? `?${q}` : ''}`);
  },
  updateAlert: (
    alertId: string,
    body: { status?: string; admin_notes?: string; is_read?: boolean },
  ) => request<ApiAlert>(`/alerts/${alertId}`, { method: 'PATCH', body }),
  deleteAlert: (alertId: string) =>
    request<{ detail: string }>(`/alerts/${alertId}`, { method: 'DELETE' }),

  /** Omit `days` for all-time; pass it to narrow every count to a recent window. */
  analyticsSummary: (days?: number) =>
    request<AnalyticsSummary>(
      days ? `/analytics/summary?days=${days}` : '/analytics/summary',
    ),
};
