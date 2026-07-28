import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  FileText,
  Sparkles,
  RotateCw,
  Video,
  Loader2,
  BookOpen,
  Link,
  X,
  Play,
  ExternalLink,
  Quote,
  Download,
  Pencil,
  Check,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { rag, RagError, mediaUrl, type IngestProgress, type QuerySource } from '../lib/rag';
import { api } from '../lib/api';
import { LektaLogo } from '../components/LektaLogo';
import { Button, IconButton, Badge, EmptyState, ErrorBlock } from '../components/ui';
import { Markdown } from '../components/Markdown';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : 'Copy answer'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard permission can be denied; still confirm so the control
          // never looks unresponsive.
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    />
  );
};

type Stage = 'welcome' | 'compose' | 'workspace';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  sources?: QuerySource[];
  // Set on editable user questions: the text to (re)send to the RAG service.
  // Absent on non-question messages (uploads, shared links, action chips).
  query?: string;
  // Set on a bot answer while it is being regenerated after an edit.
  pending?: boolean;
  // Failures used to be appended as ordinary bot messages, so they rendered in
  // the same grey bubble as a real answer with no way to retry. Flagged now so
  // the thread can give them their own treatment.
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

interface UserDashboardProps {
  initialSession?: ChatSession | null;
  onPersist?: (session: ChatSession) => void;
}

const INPUT_CHIPS = [
  { id: 'notes', label: 'Generate Notes', icon: FileText },
  { id: 'assistance', label: 'Assistance', icon: Sparkles },
];

// Full prompts sent to the RAG service when an action chip is clicked. The
// user's message bubble shows a short label instead of this whole prompt.
const ACTION_PROMPTS: Record<string, string> = {
  notes:
    'Generate clear, well-structured study notes for this lecture. Use short headings and bullet points covering the key topics, important definitions, any formulas or examples, and the main takeaways. Base everything only on the lecture content.',
  assistance:
    'Give me a short overview of what this lecture covers, then suggest 3–5 useful questions I could ask about it. Base it only on the lecture content.',
};

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ResetButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 text-sm font-medium text-sky-500 hover:text-sky-600 transition"
  >
    <RotateCw className="w-4 h-4" />
    Reset
  </button>
);

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
};

const STAGE_LABELS: Record<string, string> = {
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

const ProcessingProgress: React.FC<{ progress: IngestProgress }> = ({ progress }) => (
  <div className="w-full max-w-md mx-auto space-y-4">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {STAGE_LABELS[progress.stage] ?? 'Processing'}
      </span>
      <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
        {progress.percent}%
      </span>
    </div>
    <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
        style={{ width: `${progress.percent}%` }}
      />
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{progress.message}</p>
  </div>
);

// The citation is the thing Lekta has that a general chatbot does not, so it
// gets the most craft in the app: the timestamp sits in its own tinted well,
// and the body shows the actual transcript line as proof rather than a label.
// The whole chip is one ~44px target — the old one was a 24px button with a
// second 24px link nested beside it, which failed Fitts and was near-untappable.
const SourceChip: React.FC<{ source: QuerySource; onJump: () => void }> = ({ source, onJump }) => {
  const quote = source.text?.trim();
  return (
    <span className="inline-flex items-stretch max-w-[340px] rounded-md overflow-hidden
      border border-line bg-surface shadow-e1 transition-all duration-200
      hover:border-accent hover:shadow-e2 hover:-translate-y-px">
      <button
        type="button"
        onClick={onJump}
        title={quote ? quote.slice(0, 220) : 'Jump to this moment'}
        className="flex items-stretch text-left min-w-0
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <span className="flex items-center gap-1.5 px-2.5 shrink-0 bg-accent-soft text-accent-ink
          border-r border-line font-mono text-[11px] font-semibold tabular-nums">
          <Play className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
          {source.timestamp_label}
        </span>
        <span className="px-3 py-1.5 min-w-0">
          <span className="block text-[12.5px] font-medium text-content truncate">
            {quote ? `“${quote.slice(0, 90)}”` : 'Jump to this moment'}
          </span>
          <span className="block text-[11px] text-content-muted truncate">
            {source.lecture_title}
          </span>
        </span>
      </button>
      {source.deep_link && (
        <a
          href={source.deep_link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${source.lecture_title} at ${source.timestamp_label} in a new tab`}
          className="grid place-items-center w-9 shrink-0 border-l border-line
            text-content-muted hover:bg-surface-sunk hover:text-content transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      )}
    </span>
  );
};

export const UserDashboard: React.FC<UserDashboardProps> = ({ initialSession, onPersist }) => {
  const [sessionId, setSessionId] = useState(() => initialSession?.id ?? makeId());
  const [stage, setStage] = useState<Stage>(initialSession ? 'workspace' : 'compose');
  const [input, setInput] = useState('');
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages ?? []);
  const [typing, setTyping] = useState(false);
  const [activeChip, setActiveChip] = useState('notes');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [videoName, setVideoName] = useState(initialSession?.videoName ?? '');
  const [videoId, setVideoId] = useState<string | null>(initialSession?.videoId ?? null);
  const [mediaKey, setMediaKey] = useState<string | null>(
    initialSession?.mediaKey ?? initialSession?.videoId ?? initialSession?.transcriptId ?? null,
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(() =>
    mediaUrl(initialSession?.mediaKey ?? initialSession?.videoId ?? initialSession?.transcriptId ?? null),
  );
  const [searchAllLectures, setSearchAllLectures] = useState(false);
  const [transcriptId, setTranscriptId] = useState<string | null>(
    initialSession?.transcriptId ?? null,
  );
  const [transcript, setTranscript] = useState<TranscriptInfo | null>(
    initialSession?.transcript ?? null,
  );
  const [processing, setProcessing] = useState(false);
  const [ingestProgress, setIngestProgress] = useState<IngestProgress>({
    percent: 0,
    stage: 'uploading',
    message: 'Starting…',
  });
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const answersEndRef = useRef<HTMLDivElement>(null);
  const questionsEndRef = useRef<HTMLDivElement>(null);
  const syncedRef = useRef(!!initialSession);

  const userMessages = messages.filter((m) => m.role === 'user');
  const botMessages = messages.filter((m) => m.role === 'bot');
  // A middle answer is being regenerated after an edit (shows an inline spinner
  // on that answer, so suppress the bottom "typing" indicator).
  const isRegenerating = messages.some((m) => m.role === 'bot' && m.pending);

  useEffect(() => {
    answersEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [botMessages, typing]);

  useEffect(() => {
    questionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [userMessages]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== 'workspace' || messages.length === 0) return;

    const session: ChatSession = {
      id: sessionId,
      title: messages[0]?.content?.slice(0, 60) || 'New chat',
      messages,
      videoName,
      videoId,
      mediaKey,
      step: 0,
      updatedAt: Date.now(),
      transcriptId,
      transcript,
    };
    onPersist?.(session);

    const payload = {
      title: session.title,
      video_name: session.videoName || null,
      video_id: session.videoId || null,
      transcript_id: session.transcriptId || null,
      step: session.step,
      messages: session.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const sync = async () => {
      try {
        if (!syncedRef.current) {
          const created = await api.createChat(payload);
          syncedRef.current = true;
          if (created.id !== sessionId) {
            setSessionId(created.id);
            onPersist?.({ ...session, id: created.id });
          }
        } else {
          await api.updateChat(sessionId, payload);
        }
      } catch {
        if (syncedRef.current) {
          syncedRef.current = false;
          try {
            const created = await api.createChat(payload);
            syncedRef.current = true;
            if (created.id !== sessionId) {
              setSessionId(created.id);
              onPersist?.({ ...session, id: created.id });
            }
          } catch {
            /* backend sync is best-effort */
          }
        }
      }
    };
    sync();
  }, [messages, videoName, videoId, mediaKey, stage, sessionId, transcriptId, transcript, onPersist]);

  const reset = () => {
    syncedRef.current = false;
    setSessionId(makeId());
    setStage('compose');
    setInput('');
    setWorkspaceInput('');
    setMessages([]);
    setTyping(false);
    setActiveChip('notes');
    setVideoName('');
    setVideoId(null);
    setMediaKey(null);
    setVideoUrl(null);
    setSearchAllLectures(false);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setTranscriptId(null);
    setTranscript(null);
    setProcessing(false);
    setIngestProgress({ percent: 0, stage: 'uploading', message: 'Starting…' });
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const appendMessage = (
    role: ChatMessage['role'],
    content: string,
    sources?: QuerySource[],
    query?: string,
  ) => {
    setMessages((prev) => [...prev, { id: makeId(), role, content, sources, query }]);
  };

  const appendError = (content: string) => {
    setMessages((prev) => [...prev, { id: makeId(), role: 'bot', content, isError: true }]);
  };

  // Jump the video player to the exact moment a cited source came from. If the
  // citation belongs to a different lecture (e.g. "search all lectures"), load
  // that lecture's media first and seek once its metadata is ready.
  const jumpToSource = (source: QuerySource) => {
    const start = source.start_seconds ?? 0;
    const sourceKey = source.video_id ?? source.transcript_id ?? null;
    const targetUrl = mediaUrl(sourceKey);
    if (!targetUrl || !sourceKey) return;

    if (sourceKey !== mediaKey) {
      pendingSeekRef.current = start;
      setMediaKey(sourceKey);
      setVideoUrl(targetUrl);
      return;
    }

    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = start;
        void video.play().catch(() => {});
        video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
  };

  const handleVideoMetadata = () => {
    if (pendingSeekRef.current != null && videoRef.current) {
      videoRef.current.currentTime = pendingSeekRef.current;
      void videoRef.current.play().catch(() => {});
      pendingSeekRef.current = null;
    }
  };

  const downloadTranscript = async () => {
    if (!transcriptId) return;
    try {
      const detail = await rag.getTranscript(transcriptId);
      const text = detail.english_text || detail.original_text || '';
      if (!text) {
        appendError('This transcript has no text to download.');
        return;
      }
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(detail.title || 'transcript').replace(/[^\w.-]+/g, '_')}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof RagError ? err.message : 'Could not fetch the transcript.';
      appendError(`Couldn't download the transcript. ${msg}`);
    }
  };

  const handleVideoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setVideoName(file.name);
    setStage('workspace');
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = URL.createObjectURL(file);
    setVideoUrl(blobUrlRef.current);
    appendMessage('user', `Uploaded video: ${file.name}`);
    setProcessing(true);
    setIngestProgress({ percent: 0, stage: 'uploading', message: 'Uploading video…' });

    const sizeMb = Math.max(1, Math.round(file.size / (1024 * 1024)));
    let videoId: string | undefined;
    try {
      const video = await api.createVideo({
        title: file.name,
        size_mb: sizeMb,
        status: 'processing',
      });
      videoId = video.id;
      setVideoId(video.id);
      setMediaKey(video.id);
    } catch {
      /* library record optional */
    }

    try {
      const res = await rag.ingestWithProgress(file, setIngestProgress, file.name, videoId);
      if (videoId) {
        await api.updateVideo(videoId, {
          status: 'processed',
          duration_seconds: Math.round(res.duration_seconds),
        });
      }
      const key = res.media_key ?? videoId ?? res.transcript_id;
      setMediaKey(key);
      setVideoUrl(mediaUrl(key));
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setIngestProgress({ percent: 100, stage: 'complete', message: 'Video processed and ready.' });
      setTranscriptId(res.transcript_id);
      setTranscript({
        id: res.transcript_id,
        language: res.language,
        durationSeconds: res.duration_seconds,
        numChunks: res.num_chunks,
      });
      appendMessage(
        'bot',
        `I've transcribed and indexed "${file.name}" (language: ${res.language}, length: ${formatDuration(
          res.duration_seconds,
        )}, ${res.num_chunks} sections). Ask me anything about this video!`,
      );
    } catch (err) {
      if (videoId) {
        await api.updateVideo(videoId, { status: 'failed' }).catch(() => {});
      }
      const msg =
        err instanceof RagError
          ? err.message
          : 'Something went wrong while processing the video.';
      appendError(`Couldn't process that video. ${msg}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleUrlSubmit = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setShowUrlModal(false);
    setUrlInput('');

    const isYouTube = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
    const isGDrive = /drive\.google\.com\//.test(url);
    if (!isYouTube && !isGDrive) {
      appendError('That link is not a YouTube or Google Drive URL. Check it and try again.');
      return;
    }

    const label = isYouTube ? 'YouTube video' : 'Google Drive video';
    setVideoName(label);
    setStage('workspace');
    setVideoUrl(null);
    appendMessage('user', `Shared link: ${url}`);
    setProcessing(true);
    setIngestProgress({ percent: 0, stage: 'downloading', message: `Downloading ${label}…` });

    let videoId: string | undefined;
    try {
      const video = await api.createVideo({
        title: label,
        size_mb: 0,
        status: 'processing',
      });
      videoId = video.id;
      setVideoId(video.id);
      setMediaKey(video.id);
    } catch {
      /* library record optional */
    }

    try {
      const res = await rag.ingestUrlWithProgress(url, setIngestProgress, undefined, videoId);
      const finalTitle = res.media_key ? label : label;
      if (videoId) {
        await api.updateVideo(videoId, {
          title: finalTitle,
          status: 'processed',
          duration_seconds: Math.round(res.duration_seconds),
        });
      }
      const key = res.media_key ?? videoId ?? res.transcript_id;
      setMediaKey(key);
      setVideoUrl(mediaUrl(key));
      setVideoName(finalTitle);
      setIngestProgress({ percent: 100, stage: 'complete', message: 'Video processed and ready.' });
      setTranscriptId(res.transcript_id);
      setTranscript({
        id: res.transcript_id,
        language: res.language,
        durationSeconds: res.duration_seconds,
        numChunks: res.num_chunks,
      });
      appendMessage(
        'bot',
        `I've downloaded, transcribed, and indexed the ${label} (language: ${res.language}, length: ${formatDuration(
          res.duration_seconds,
        )}, ${res.num_chunks} sections). Ask me anything about this video!`,
      );
    } catch (err) {
      if (videoId) {
        await api.updateVideo(videoId, { status: 'failed' }).catch(() => {});
      }
      const msg =
        err instanceof RagError
          ? err.message
          : 'Something went wrong while processing the video.';
      appendError(`Couldn't process that video. ${msg}`);
    } finally {
      setProcessing(false);
    }
  };

  const ask = async (question: string, displayText?: string, topK?: number) => {
    const text = question.trim();
    if (!text || typing) return;

    setStage('workspace');
    // Mark plain typed questions (no display label) as editable by storing the
    // query; action/upload messages pass a displayText and stay non-editable.
    appendMessage('user', displayText ?? text, undefined, displayText ? undefined : text);
    setTyping(true);

    try {
      const res = await rag.query(text, {
        transcriptId: searchAllLectures ? null : transcriptId,
        videoId: searchAllLectures ? null : videoId,
        searchAll: searchAllLectures,
        topK,
      });
      appendMessage('bot', res.answer, res.sources);
    } catch (err) {
      const msg =
        err instanceof RagError ? err.message : 'Something went wrong while answering.';
      appendError(`Couldn't answer that. ${msg}`);
    } finally {
      setTyping(false);
    }
  };

  const startWorkspace = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    setInput('');
    ask(text);
  };

  const sendWorkspaceMessage = () => {
    const text = workspaceInput.trim();
    if (!text) return;
    setWorkspaceInput('');
    ask(text);
  };

  // Run an action chip (Generate Notes / Assistance): send its full prompt to
  // the RAG service while showing a short label in the user's message column.
  const runAction = (chipId: string) => {
    if (typing) return;
    const prompt = ACTION_PROMPTS[chipId];
    if (!prompt) return;
    setActiveChip(chipId);
    // Notes should span the whole lecture, so pull more chunks than a normal Q&A.
    ask(prompt, chipId === 'notes' ? 'Generate notes' : 'I need assistance', chipId === 'notes' ? 12 : undefined);
  };

  // ---------- Edit a previous question (ChatGPT-style) ----------
  const startEdit = (m: ChatMessage) => {
    if (typing) return; // pause: don't allow editing while an answer is generating
    setEditingId(m.id);
    setEditText(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  // Re-query and replace the answer that follows a given question, in place.
  const regenerateAnswer = async (userId: string, question: string) => {
    setTyping(true);
    const applyAnswer = (payload: Partial<ChatMessage>) =>
      setMessages((prev) => {
        const idx = prev.findIndex((x) => x.id === userId);
        if (idx === -1) return prev;
        const next = [...prev];
        const botIdx = next.findIndex((x, i) => i > idx && x.role === 'bot');
        if (botIdx !== -1) {
          next[botIdx] = { ...next[botIdx], ...payload, pending: false };
        } else {
          next.splice(idx + 1, 0, {
            id: makeId(),
            role: 'bot',
            content: payload.content ?? '',
            sources: payload.sources,
            pending: false,
          });
        }
        return next;
      });

    try {
      const res = await rag.query(question, {
        transcriptId: searchAllLectures ? null : transcriptId,
        videoId: searchAllLectures ? null : videoId,
        searchAll: searchAllLectures,
      });
      applyAnswer({ content: res.answer, sources: res.sources, isError: false });
    } catch (err) {
      const msg = err instanceof RagError ? err.message : 'Something went wrong while answering.';
      applyAnswer({ content: `Couldn't answer that. ${msg}`, sources: undefined, isError: true });
    } finally {
      setTyping(false);
    }
  };

  // Re-ask the question that produced a given answer. Walks back to the nearest
  // preceding question that carries a `query` — uploads and shared links do not.
  const regenerateFor = (botId: string) => {
    const idx = messages.findIndex((m) => m.id === botId);
    if (idx === -1) return;
    for (let i = idx - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user' && m.query !== undefined) {
        setMessages((prev) =>
          prev.map((x) =>
            x.id === botId ? { ...x, content: '', sources: undefined, pending: true } : x,
          ),
        );
        regenerateAnswer(m.id, m.query);
        return;
      }
    }
  };

  const saveEdit = (m: ChatMessage) => {
    const newText = editText.trim();
    setEditingId(null);
    setEditText('');
    if (!newText || newText === m.content) return;

    // Replace the question in place (same message, no new bubble) and mark its
    // paired answer as regenerating.
    setMessages((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: newText, query: newText };
      const botIdx = next.findIndex((x, i) => i > idx && x.role === 'bot');
      if (botIdx !== -1) {
        next[botIdx] = { ...next[botIdx], content: '', sources: undefined, pending: true };
      }
      return next;
    });

    regenerateAnswer(m.id, newText);
  };

  // ---------- Welcome + Compose (shared centered layout) ----------
  if (stage === 'welcome' || stage === 'compose') {
    return (
      <div className="relative h-full bg-white dark:bg-slate-900 flex flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={handleVideoSelected}
        />

        {showUrlModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4 animate-fade-in"
            onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="url-modal-title"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowUrlModal(false); setUrlInput(''); }
              }}
              className="bg-surface border border-line rounded-xl shadow-e3 w-full max-w-md p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 id="url-modal-title" className="text-h3 text-content">Paste a lecture link</h3>
                <IconButton
                  icon={X}
                  label="Close"
                  onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
                  className="-mt-1 -mr-2"
                />
              </div>
              <p className="text-cap text-content-muted mb-4">
                YouTube or Google Drive. We fetch the audio, transcribe it, and index it for questions.
              </p>
              <label htmlFor="lekta-url" className="sr-only">Lecture URL</label>
              <input
                id="lekta-url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
                placeholder="https://youtube.com/watch?v=…"
                className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-surface
                  text-content placeholder:text-content-disabled text-sm outline-none
                  focus:border-accent focus:ring-4 focus:ring-accent/15 transition"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-5">
                <Button
                  variant="ghost"
                  onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                  Transcribe
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="absolute top-5 right-6 z-10">
          <ResetButton onClick={reset} />
        </div>

        <div
          className={`flex-1 flex flex-col items-center px-6 transition-all duration-500 ease-ease ${
            stage === 'compose' ? 'justify-start pt-16' : 'justify-center pb-16'
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <LektaLogo size={stage === 'compose' ? 44 : 60} />
            <h1 className="mt-5 text-display text-content">
              Ask the lecture anything
            </h1>
            <p className="mt-3 text-content-muted text-[15px] max-w-[46ch] leading-relaxed">
              Upload a recording or paste a link. Lekta transcribes it, then answers
              your questions with the exact moment it was said.
            </p>
          </div>

          {/* Compose */}
          {stage === 'compose' && (
            <div className="w-full max-w-2xl mt-10 animate-slide-in">
              <div
                className="rounded-xl border border-line-strong bg-surface shadow-e2 p-3
                  transition-shadow duration-200
                  focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15"
              >
                <label htmlFor="lekta-compose" className="sr-only">
                  Ask about this lecture
                </label>
                <textarea
                  id="lekta-compose"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      startWorkspace(input);
                    }
                  }}
                  rows={2}
                  placeholder="Ask a question, or upload a lecture to begin…"
                  className="w-full resize-none bg-transparent px-2 pt-1.5 text-content
                    placeholder:text-content-disabled text-[15px] leading-relaxed outline-none"
                />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button size="sm" variant="secondary" icon={Video} onClick={openFilePicker}>
                      Upload
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Link}
                      onClick={() => setShowUrlModal(true)}
                    >
                      Paste link
                    </Button>
                    {INPUT_CHIPS.map((chip) => (
                      <Button
                        key={chip.id}
                        size="sm"
                        variant="ghost"
                        icon={chip.icon}
                        onClick={() => runAction(chip.id)}
                        disabled={typing || !transcript}
                        title={!transcript ? 'Upload or ingest a video first' : chip.label}
                        className="hidden sm:inline-flex"
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>
                  <IconButton
                    icon={Send}
                    label="Send"
                    onClick={() => startWorkspace(input)}
                    disabled={!input.trim()}
                    className="bg-accent text-white hover:bg-accent-hover hover:text-white
                      disabled:bg-surface-sunk disabled:text-content-disabled shrink-0"
                  />
                </div>
              </div>

              {!transcript && (
                <p className="mt-4 text-center text-cap text-content-muted">
                  No lecture loaded yet — upload one to unlock notes and summaries.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Workspace ----------
  // One conversation, not two columns. The old layout put questions in a right
  // column and answers in a left one, so a question was paired to its answer
  // purely by position — the two desynced as soon as one side was taller.
  return (
    <div className="h-full bg-canvas flex flex-col overflow-hidden
      lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={handleVideoSelected}
      />

      {showUrlModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4 animate-fade-in"
          onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="url-modal-title-ws"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setShowUrlModal(false); setUrlInput(''); }
            }}
            className="bg-surface border border-line rounded-xl shadow-e3 w-full max-w-md p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 id="url-modal-title-ws" className="text-h3 text-content">Paste a lecture link</h3>
              <IconButton
                icon={X}
                label="Close"
                onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
                className="-mt-1 -mr-2"
              />
            </div>
            <p className="text-cap text-content-muted mb-4">
              YouTube or Google Drive. We fetch the audio, transcribe it, and index it for questions.
            </p>
            <label htmlFor="lekta-url-ws" className="sr-only">Lecture URL</label>
            <input
              id="lekta-url-ws"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
              placeholder="https://youtube.com/watch?v=…"
              className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-surface
                text-content placeholder:text-content-disabled text-sm outline-none
                focus:border-accent focus:ring-4 focus:ring-accent/15 transition"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => { setShowUrlModal(false); setUrlInput(''); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                Transcribe
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Lecture panel ---------- */}
      <aside
        aria-label="Lecture"
        className="shrink-0 flex flex-col gap-4 p-4 bg-surface border-b lg:border-b-0 lg:border-r
          border-line lg:h-full lg:overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-content truncate">
            {videoName || 'Lecture'}
          </h2>
          <ResetButton onClick={reset} />
        </div>

        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            onLoadedMetadata={handleVideoMetadata}
            className="w-full rounded-md border border-line bg-black aspect-video object-contain
              max-h-40 lg:max-h-none"
          />
        ) : (
          <div className="w-full aspect-video rounded-md border border-dashed border-line-strong
            bg-surface-sunk grid place-items-center max-h-40 lg:max-h-none">
            <span className="text-cap text-content-muted">No video loaded</span>
          </div>
        )}

        {transcript && !processing && (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="ok">{transcript.numChunks} sections indexed</Badge>
              <Badge tone="neutral">{transcript.language.toUpperCase()}</Badge>
              <Badge tone="neutral">{formatDuration(transcript.durationSeconds)}</Badge>
            </div>
            <Button size="sm" variant="secondary" icon={Download} onClick={downloadTranscript}>
              Download transcript
            </Button>
          </>
        )}

        {processing && (
          <div className="rounded-md border border-line bg-canvas p-3">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" aria-hidden="true" />
              <span className="text-[13px] font-medium text-content">Preparing lecture</span>
            </div>
            <ProcessingProgress progress={ingestProgress} />
          </div>
        )}

        <label className="flex items-center gap-2.5 text-cap text-content-muted cursor-pointer
          rounded-md px-1 py-1 hover:text-content transition-colors">
          <input
            type="checkbox"
            checked={searchAllLectures}
            onChange={(e) => setSearchAllLectures(e.target.checked)}
            className="rounded-sm border-line-strong text-accent focus:ring-accent"
          />
          <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Search across all my lectures
        </label>
      </aside>

      {/* ---------- Conversation ---------- */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full px-5 py-6 flex flex-col gap-6">
            {messages.length === 0 && !typing && !processing && (
              <div className="pt-10">
                <EmptyState
                  icon={Quote}
                  title={transcript ? 'Ask your first question' : 'Upload a lecture to begin'}
                  body={
                    transcript
                      ? 'Every answer comes back with the exact moment in the video it came from.'
                      : 'Upload a recording or paste a link. Transcription takes about a minute per 10 minutes of video.'
                  }
                >
                  {!transcript && !processing && (
                    <>
                      <Button variant="primary" icon={Video} onClick={openFilePicker}>
                        Upload lecture
                      </Button>
                      <Button variant="secondary" icon={Link} onClick={() => setShowUrlModal(true)}>
                        Paste link
                      </Button>
                    </>
                  )}
                </EmptyState>
              </div>
            )}

            {messages.map((m) => {
              // ---- Question ----
              if (m.role === 'user') {
                if (editingId === m.id) {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="w-full max-w-[80%] rounded-lg border border-accent bg-accent-soft p-2.5">
                        <label htmlFor={`edit-${m.id}`} className="sr-only">Edit your question</label>
                        <textarea
                          id={`edit-${m.id}`}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                          rows={2}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(m); }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="w-full resize-none bg-transparent text-sm text-content outline-none px-1"
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => saveEdit(m)}
                            disabled={!editText.trim()}
                          >
                            Save &amp; regenerate
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="flex justify-end items-start gap-2 group">
                    {m.query !== undefined && (
                      // Was `opacity-0 group-hover:opacity-100` with no focus
                      // counterpart, so editing was unreachable by keyboard and
                      // invisible on touch. Now it only fades on hover-capable
                      // pointers and always reappears on focus.
                      <IconButton
                        icon={Pencil}
                        label="Edit and regenerate"
                        onClick={() => startEdit(m)}
                        disabled={typing}
                        className="mt-0.5 shrink-0 md:opacity-0 md:group-hover:opacity-100
                          md:focus-visible:opacity-100 transition-opacity"
                      />
                    )}
                    <div className="max-w-[80%] px-4 py-2.5 rounded-lg bg-accent text-white
                      text-[14.5px] leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                );
              }

              // ---- Failure ----
              if (m.isError) {
                return (
                  <div key={m.id} className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5"><LektaLogo size={26} /></span>
                    <div className="min-w-0 flex-1">
                      <ErrorBlock title="That didn't work" body={m.content}>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={RefreshCw}
                          onClick={() => regenerateFor(m.id)}
                          disabled={typing}
                        >
                          Try again
                        </Button>
                      </ErrorBlock>
                    </div>
                  </div>
                );
              }

              // ---- Answer ----
              return (
                <div key={m.id} className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5"><LektaLogo size={26} /></span>
                  <div className="min-w-0 flex-1">
                    {m.pending ? (
                      <span className="inline-flex items-center gap-2 text-sm text-content-muted">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Regenerating…
                      </span>
                    ) : (
                      <>
                        {/* Answers are markdown — the RAG prompt asks for headings
                            and bullets, which used to render as literal characters. */}
                        <Markdown>{m.content}</Markdown>

                        {m.sources && m.sources.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center gap-1.5 text-label text-content-muted mb-2">
                              <Quote className="w-3 h-3" aria-hidden="true" />
                              From the lecture
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {m.sources.map((s, i) => (
                                <SourceChip
                                  key={`${m.id}-src-${i}`}
                                  source={s}
                                  onJump={() => jumpToSource(s)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-0.5 mt-2 -ml-1.5">
                          <CopyButton text={m.content} />
                          <IconButton
                            icon={RefreshCw}
                            label="Regenerate answer"
                            onClick={() => regenerateFor(m.id)}
                            disabled={typing}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Concrete progress, announced to screen readers — the first time
                the app tells assistive tech that an answer is on its way. */}
            {typing && !isRegenerating && (
              <div className="flex items-center gap-3" role="status" aria-live="polite">
                <span className="shrink-0"><LektaLogo size={26} /></span>
                <span className="flex items-center gap-2 text-cap text-content-muted">
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 160, 320].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-content-disabled animate-bounce-dot"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                  {transcript ? `Searching ${transcript.numChunks} sections…` : 'Thinking…'}
                </span>
              </div>
            )}

            <div ref={answersEndRef} />
            <div ref={questionsEndRef} />
          </div>
        </div>

        {/* ---------- Composer ---------- */}
        <div className="shrink-0 border-t border-line bg-canvas px-5 py-4">
          <div className="max-w-3xl mx-auto w-full">
            <div className="rounded-lg border border-line-strong bg-surface shadow-e1 p-2.5
              transition-shadow focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
              <div className="flex items-end gap-2">
                <label htmlFor="lekta-ask" className="sr-only">Ask about this lecture</label>
                <textarea
                  id="lekta-ask"
                  value={workspaceInput}
                  onChange={(e) => setWorkspaceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendWorkspaceMessage();
                    }
                  }}
                  rows={1}
                  disabled={processing}
                  placeholder={
                    processing
                      ? 'Preparing the lecture…'
                      : transcript
                        ? 'Ask about this lecture…'
                        : 'Upload a lecture first, then ask anything'
                  }
                  className="flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[14.5px]
                    text-content placeholder:text-content-disabled outline-none
                    disabled:cursor-not-allowed"
                />
                <IconButton
                  icon={Send}
                  label="Send"
                  onClick={sendWorkspaceMessage}
                  disabled={typing || processing || !workspaceInput.trim()}
                  className="bg-accent text-white hover:bg-accent-hover hover:text-white
                    disabled:bg-surface-sunk disabled:text-content-disabled shrink-0"
                />
              </div>

              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Button size="sm" variant="ghost" icon={Video} onClick={openFilePicker}>
                  Upload
                </Button>
                <Button size="sm" variant="ghost" icon={Link} onClick={() => setShowUrlModal(true)}>
                  Paste link
                </Button>
                {INPUT_CHIPS.map((chip) => (
                  <Button
                    key={chip.id}
                    size="sm"
                    variant="ghost"
                    icon={chip.icon}
                    onClick={() => runAction(chip.id)}
                    disabled={typing || !transcript}
                    title={!transcript ? 'Upload or ingest a video first' : `Ask Lekta to ${chip.label.toLowerCase()}`}
                    className={activeChip === chip.id ? 'text-accent-ink bg-accent-soft' : ''}
                  >
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
