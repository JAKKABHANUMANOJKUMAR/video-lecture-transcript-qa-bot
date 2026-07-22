import { tokenStore } from './api';

// Empty string = same origin (single-server Docker / nginx gateway)
const RAG_URL =
  import.meta.env.VITE_RAG_API_URL !== undefined
    ? import.meta.env.VITE_RAG_API_URL
    : import.meta.env.DEV
      ? 'http://localhost:8100'
      : '';

// The RAG service validates the same JWT the backend issues, so it can scope
// every ingest/query to the signed-in user.
function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = tokenStore.get();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
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
  media_key?: string | null;
}

export interface IngestProgress {
  percent: number;
  stage: string;
  message: string;
}

export interface QuerySource {
  text: string;
  metadata: Record<string, unknown>;
  distance: number | null;
  similarity: number;
  lecture_title: string;
  transcript_id: string;
  video_id: string | null;
  chunk_index?: number;
  start_seconds: number | null;
  end_seconds: number | null;
  source_url?: string | null;
  deep_link?: string | null;
  timestamp_label: string;
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
}

export interface TranscriptDetail {
  transcript_id: string;
  title: string | null;
  language: string;
  is_english: boolean;
  duration_seconds: number;
  original_text: string;
  english_text: string;
  source_url: string | null;
}

export function mediaUrl(mediaKey: string | null | undefined): string | null {
  if (!mediaKey) return null;
  return `${RAG_URL}/media/${encodeURIComponent(mediaKey)}`;
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

function uploadIngestJob(
  file: File,
  title: string | undefined,
  videoId: string | undefined,
  onUploadProgress: (uploadPercent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (videoId) form.append('video_id', videoId);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${RAG_URL}/ingest`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const uploadPct = Math.round((event.loaded / event.total) * 15);
      onUploadProgress(uploadPct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { job_id: string };
          resolve(data.job_id);
        } catch {
          reject(new RagError('Invalid response from RAG service.', xhr.status));
        }
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText);
        const detail =
          typeof data?.detail === 'string' ? data.detail : `Request failed (${xhr.status})`;
        reject(new RagError(detail, xhr.status));
      } catch {
        reject(new RagError(`Request failed (${xhr.status})`, xhr.status));
      }
    };

    xhr.onerror = () =>
      reject(new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0));

    xhr.send(form);
  });
}

async function pollIngestJob(
  jobId: string,
  onProgress: (progress: IngestProgress) => void,
): Promise<IngestResponse> {
  const pollMs = 500;

  for (;;) {
    let res: Response;
    try {
      res = await fetch(`${RAG_URL}/ingest/status/${jobId}`);
    } catch {
      throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
    }

    if (!res.ok) throw new RagError(await parseError(res), res.status);

    const data = (await res.json()) as {
      status: string;
      percent: number;
      stage: string;
      message: string;
      error?: string;
      result?: IngestResponse;
    };

    onProgress({
      percent: data.percent,
      stage: data.stage,
      message: data.message,
    });

    if (data.status === 'completed' && data.result) {
      return data.result;
    }
    if (data.status === 'failed') {
      throw new RagError(data.error || 'Video processing failed.', 500);
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

async function submitUrlIngestJob(
  url: string,
  title: string | undefined,
  videoId: string | undefined,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${RAG_URL}/ingest/url`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url, title: title || null, video_id: videoId || null }),
    });
  } catch {
    throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
  }
  if (!res.ok) throw new RagError(await parseError(res), res.status);
  const data = (await res.json()) as { job_id: string };
  return data.job_id;
}

export const rag = {
  ingestWithProgress: async (
    file: File,
    onProgress: (progress: IngestProgress) => void,
    title?: string,
    videoId?: string,
  ): Promise<IngestResponse> => {
    const jobId = await uploadIngestJob(file, title, videoId, (uploadPct) => {
      onProgress({
        percent: uploadPct,
        stage: 'uploading',
        message: 'Uploading video…',
      });
    });

    onProgress({ percent: 15, stage: 'processing', message: 'Upload complete — processing…' });

    return pollIngestJob(jobId, (serverProgress) => {
      onProgress({
        percent: Math.max(15, serverProgress.percent),
        stage: serverProgress.stage,
        message: serverProgress.message,
      });
    });
  },

  ingestUrlWithProgress: async (
    url: string,
    onProgress: (progress: IngestProgress) => void,
    title?: string,
    videoId?: string,
  ): Promise<IngestResponse> => {
    onProgress({ percent: 2, stage: 'downloading', message: 'Submitting URL for download…' });

    const jobId = await submitUrlIngestJob(url, title, videoId);

    return pollIngestJob(jobId, (serverProgress) => {
      onProgress({
        percent: Math.max(2, serverProgress.percent),
        stage: serverProgress.stage,
        message: serverProgress.message,
      });
    });
  },

  ingest: async (file: File, title?: string, videoId?: string): Promise<IngestResponse> => {
    return rag.ingestWithProgress(file, () => {}, title, videoId);
  },

  query: async (
    question: string,
    options?: {
      transcriptId?: string | null;
      videoId?: string | null;
      topK?: number;
      searchAll?: boolean;
    },
  ): Promise<QueryResponse> => {
    let res: Response;
    try {
      res = await fetch(`${RAG_URL}/query`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          question,
          transcript_id: options?.transcriptId ?? null,
          video_id: options?.videoId ?? null,
          top_k: options?.topK ?? null,
          search_all: options?.searchAll ?? false,
        }),
      });
    } catch {
      throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
    }
    if (!res.ok) throw new RagError(await parseError(res), res.status);
    return (await res.json()) as QueryResponse;
  },

  getTranscript: async (transcriptId: string): Promise<TranscriptDetail> => {
    let res: Response;
    try {
      res = await fetch(`${RAG_URL}/transcript/${encodeURIComponent(transcriptId)}`, {
        headers: authHeaders(),
      });
    } catch {
      throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
    }
    if (!res.ok) throw new RagError(await parseError(res), res.status);
    return (await res.json()) as TranscriptDetail;
  },

  deleteTranscript: async (transcriptId: string): Promise<void> => {
    let res: Response;
    try {
      res = await fetch(`${RAG_URL}/transcript/${encodeURIComponent(transcriptId)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
    } catch {
      throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
    }
    if (!res.ok) throw new RagError(await parseError(res), res.status);
  },

  // Remove all RAG data (transcript, vectors, media) tied to a backend video.
  deleteVideo: async (videoId: string): Promise<void> => {
    let res: Response;
    try {
      res = await fetch(`${RAG_URL}/video/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
    } catch {
      throw new RagError('Cannot reach the RAG service. Is it running on port 8100?', 0);
    }
    if (!res.ok) throw new RagError(await parseError(res), res.status);
  },
};
