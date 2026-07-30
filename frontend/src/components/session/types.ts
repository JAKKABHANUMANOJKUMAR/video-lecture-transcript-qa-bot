import type { QuerySource } from '../../lib/rag';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  /** RAG sources backing a bot answer. */
  sources?: QuerySource[];
  /** Present only on editable typed questions (uploads/chips are not editable). */
  query?: string;
  /** Bot answer being regenerated in place. */
  pending?: boolean;
  /** Failure message with a retry affordance. */
  isError?: boolean;
}

export interface TranscriptInfo {
  id: string;
  language: string;
  durationSeconds: number;
  numChunks: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  videoName: string;
  videoId?: string | null;
  mediaKey?: string | null;
  step: number;
  updatedAt: number;
  transcriptId?: string | null;
  transcript?: TranscriptInfo | null;
}

/** What the Desk hands the Session to start with. */
export interface SessionIntent {
  file?: File;
  url?: string;
  /** Ask about an already-processed lecture from the Library. */
  lecture?: { id: string; title: string };
}

/** Exact hidden prompts behind the quick-action chips (carried from v1). */
export const ACTION_PROMPTS: Record<string, string> = {
  notes:
    'Generate clear, well-structured study notes for this lecture. Use short headings and bullet points covering the key topics, important definitions, any formulas or examples, and the main takeaways. Base everything only on the lecture content.',
  assistance:
    'Give me a short overview of what this lecture covers, then suggest 3–5 useful questions I could ask about it. Base it only on the lecture content.',
};

export const STAGE_LABELS: Record<string, string> = {
  downloading: 'Downloading',
  uploading: 'Uploading',
  processing: 'Processing',
  loading_model: 'Loading model',
  extracting_audio: 'Extracting audio',
  transcribing: 'Transcribing',
  translating: 'Translating',
  saving: 'Saving',
  chunking: 'Chunking',
  embedding: 'Indexing',
  complete: 'Complete',
};

let counter = 0;
export function nextId(prefix = 'm'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Mirrors `detect_source` in rag/pipeline/url_download.py — keep the two in step. */
export function isYouTubeOrDriveUrl(url: string): 'youtube' | 'drive' | null {
  const u = url.trim();
  if (/youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\//i.test(u)) return 'youtube';
  // Share links (/file/d/<id>), the older ?id= forms, the docs.google.com alias,
  // and folder links (rejected server-side with an explanation).
  const isDriveHost = /(?:drive|docs|drive\.usercontent)\.google\.com\//i.test(u);
  if (isDriveHost && /(?:\/file\/d\/|[?&]id=)[\w-]{10,}|\/folders\//i.test(u)) return 'drive';
  return null;
}
