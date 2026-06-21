import { tokenStore } from './api';

// Empty string = same origin (single-server Docker / nginx gateway)
const RAG_URL =
  import.meta.env.VITE_RAG_API_URL !== undefined
    ? import.meta.env.VITE_RAG_API_URL
    : import.meta.env.DEV
      ? 'http://localhost:8100'
      : '';

/** Authorization header carrying the logged-in user's JWT, so the RAG service
 *  can scope all transcripts/queries to that user. */
function authHeader(): Record<string, string> {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class RagError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface IngestResponse {
  transcript_id: string;
  language: string;
  is_english: boolean;
  duration_seconds: number;
  num_chunks: number;
}

export interface QuerySource {
  text: string;
  metadata: Record<string, unknown>;
  distance: number;
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.detail) return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export const rag = {
  /** Upload a video/audio file: transcribe -> store -> embed. */
  ingest: async (file: File, title?: string, videoId?: string): Promise<IngestResponse> => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (videoId) form.append('video_id', videoId);

    let res: Response;
    try {
      res = await fetch(`${RAG_URL}/ingest`, {
        method: 'POST',
        headers: authHeader(),
        body: form,
      });
    } catch {
      throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
    }
    if (!res.ok) throw new RagError(await parseError(res), res.status);
    return (await res.json()) as IngestResponse;
  },

  /** Ask a question; optionally scope retrieval to one transcript/video. */
  query: async (
    question: string,
    transcriptId?: string | null,
    videoId?: string | null,
    topK?: number,
  ): Promise<QueryResponse> => {
    let res: Response;
    try {
      res = await fetch(`${RAG_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          question,
          transcript_id: transcriptId ?? null,
          video_id: videoId ?? null,
          top_k: topK ?? null,
        }),
      });
    } catch {
      throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
    }
    if (!res.ok) throw new RagError(await parseError(res), res.status);
    return (await res.json()) as QueryResponse;
  },
};
