import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  FileText,
  Sparkles,
  AudioLines,
  RotateCw,
  Video,
  CheckCircle2,
  Loader2,
  Languages,
  Clock,
  BookOpen,
  Link,
  X,
  Play,
  ExternalLink,
  Quote,
  Download,
} from 'lucide-react';
import { rag, RagError, mediaUrl, type IngestProgress, type QuerySource } from '../lib/rag';
import { api } from '../lib/api';

type Stage = 'welcome' | 'compose' | 'workspace';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  sources?: QuerySource[];
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

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const OraLogo: React.FC<{ size?: number; className?: string }> = ({ size = 64, className = '' }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 flex items-center justify-center shadow-sm">
      <div
        className="rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center"
        style={{ width: size * 0.72, height: size * 0.72 }}
      >
        <AudioLines className="text-white" style={{ width: size * 0.4, height: size * 0.4 }} />
      </div>
    </div>
    <Sparkles
      className="absolute -top-1 -right-1 text-amber-500 fill-amber-400"
      style={{ width: size * 0.28, height: size * 0.28 }}
    />
  </div>
);

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

const SourceChip: React.FC<{ source: QuerySource; onJump: () => void }> = ({ source, onJump }) => (
  <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
    <button
      onClick={onJump}
      title={source.text ? source.text.slice(0, 220) : 'Jump to this moment'}
      className="flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
    >
      <Play className="w-3 h-3 text-indigo-500 fill-indigo-500" />
      <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
        {source.timestamp_label}
      </span>
      <span className="max-w-[10rem] truncate text-slate-500 dark:text-slate-400">
        {source.lecture_title}
      </span>
    </button>
    {source.deep_link && (
      <a
        href={source.deep_link}
        target="_blank"
        rel="noopener noreferrer"
        title="Open at this moment on YouTube"
        className="flex items-center px-1.5 py-1.5 border-l border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 transition"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    )}
  </span>
);

export const UserDashboard: React.FC<UserDashboardProps> = ({ initialSession, onPersist }) => {
  const [sessionId, setSessionId] = useState(() => initialSession?.id ?? makeId());
  const [stage, setStage] = useState<Stage>(initialSession ? 'workspace' : 'compose');
  const [input, setInput] = useState('');
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages ?? []);
  const [typing, setTyping] = useState(false);
  const [activeChip, setActiveChip] = useState('notes');
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
  ) => {
    setMessages((prev) => [...prev, { id: makeId(), role, content, sources }]);
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
        appendMessage('bot', 'This transcript has no text to download.');
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
      appendMessage('bot', `Sorry, I couldn't download the transcript. ${msg}`);
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
      appendMessage('bot', `Sorry, I couldn't process that video. ${msg}`);
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
      appendMessage('bot', 'Please provide a valid YouTube or Google Drive link.');
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
      appendMessage('bot', `Sorry, I couldn't process that video. ${msg}`);
    } finally {
      setProcessing(false);
    }
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || typing) return;

    setStage('workspace');
    appendMessage('user', text);
    setTyping(true);

    try {
      const res = await rag.query(text, {
        transcriptId: searchAllLectures ? null : transcriptId,
        videoId: searchAllLectures ? null : videoId,
        searchAll: searchAllLectures,
      });
      appendMessage('bot', res.answer, res.sources);
    } catch (err) {
      const msg =
        err instanceof RagError ? err.message : 'Something went wrong while answering.';
      appendMessage('bot', `Sorry, I ran into a problem. ${msg}`);
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Paste Video Link</h3>
                <button
                  onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Paste a YouTube or Google Drive link to automatically download, transcribe, and index the video.
              </p>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
                placeholder="https://www.youtube.com/watch?v=... or drive.google.com/..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Process Video
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="absolute top-6 right-8">
          <ResetButton onClick={reset} />
        </div>

        <div
          className={`flex-1 flex flex-col items-center px-4 transition-all duration-500 ${
            stage === 'compose' ? 'justify-start pt-24' : 'justify-center'
          }`}
        >
          <button
            onClick={() => setStage('compose')}
            className="flex flex-col items-center group focus:outline-none"
            title="Ask Ora"
          >
            <OraLogo size={72} className="transition-transform group-hover:scale-105" />
            <div className="mt-2 w-16 h-0.5 bg-slate-900 dark:bg-slate-200 rounded-full" />
            <h1 className="mt-4 text-3xl font-extrabold text-indigo-500 tracking-tight">Ask Ora</h1>
          </button>

          {/* Compose text box */}
          {stage === 'compose' && (
            <div className="w-full max-w-2xl mt-16 animate-slide-in">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      startWorkspace(input);
                    }
                  }}
                  rows={2}
                  placeholder="Upload a video, then ask a question about it…"
                  className="w-full resize-none bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-base outline-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openFilePicker}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-300 hover:bg-indigo-100 transition"
                      title="Upload a video"
                    >
                      <Video className="w-4 h-4" />
                      Upload Video
                    </button>
                    <button
                      onClick={() => setShowUrlModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/20 dark:text-emerald-300 hover:bg-emerald-100 transition"
                      title="Paste a YouTube or Google Drive link"
                    >
                      <Link className="w-4 h-4" />
                      Paste Link
                    </button>
                    {INPUT_CHIPS.map((chip) => {
                      const Icon = chip.icon;
                      return (
                        <button
                          key={chip.id}
                          onClick={() => setInput((prev) => prev || chip.label)}
                          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                          <Icon className="w-4 h-4" />
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => startWorkspace(input)}
                    disabled={!input.trim()}
                    className="p-2 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
                Try{' '}
                <button
                  type="button"
                  onClick={() => setInput('Generate notes')}
                  className="underline decoration-dotted underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  Generate notes
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  onClick={() => setInput('I need assistance')}
                  className="underline decoration-dotted underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  Assistance
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Workspace (split layout) ----------
  return (
    <div className="h-full bg-white dark:bg-slate-900 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={handleVideoSelected}
      />

      {showUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Paste Video Link</h3>
              <button
                onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Paste a YouTube or Google Drive link to automatically download, transcribe, and index the video.
            </p>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
              placeholder="https://www.youtube.com/watch?v=... or drive.google.com/..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowUrlModal(false); setUrlInput(''); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Process Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left: Ora answers */}
      <div className="flex flex-col h-full overflow-hidden border-r border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <OraLogo size={28} />
            <span className="text-2xl font-extrabold text-indigo-500 tracking-tight">Ora</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">Answers</span>
          </div>
          <ResetButton onClick={reset} />
        </div>

        {videoUrl && (
          <div className="px-6 pt-4">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              onLoadedMetadata={handleVideoMetadata}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-black max-h-52 object-contain"
            />
          </div>
        )}

        {videoName && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-sm text-indigo-700 dark:text-indigo-300 w-fit">
              <Video className="w-4 h-4" />
              <span className="font-medium truncate max-w-xs">{videoName}</span>
            </div>
          </div>
        )}

        {transcript && !processing && (
          <div className="px-6 pt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
              <Languages className="w-3 h-3" /> {transcript.language.toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
              <Clock className="w-3 h-3" /> {formatDuration(transcript.durationSeconds)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> {transcript.numChunks} sections indexed
            </span>
            <button
              onClick={downloadTranscript}
              title="Download the full transcript as a text file"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <Download className="w-3 h-3" /> Transcript
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {processing && botMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 px-4">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <div className="w-full">
                <p className="font-semibold text-slate-800 dark:text-slate-100 mb-4">
                  Transcribing &amp; indexing your video…
                </p>
                <ProcessingProgress progress={ingestProgress} />
              </div>
            </div>
          ) : botMessages.length === 0 && !typing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-500 dark:text-slate-400">
              <OraLogo size={48} />
              <p className="text-sm max-w-xs">
                {transcript
                  ? 'Ask a question on the right — the answer will show up here.'
                  : 'Upload a video, then ask questions. Answers appear on this side.'}
              </p>
              {!transcript && !processing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openFilePicker}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition"
                  >
                    <Video className="w-4 h-4" />
                    Upload Video
                  </button>
                  <button
                    onClick={() => setShowUrlModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition"
                  >
                    <Link className="w-4 h-4" />
                    Paste Link
                  </button>
                </div>
              )}
            </div>
          ) : (
            botMessages.map((m) => (
              <div key={m.id} className="flex flex-col items-start gap-2">
                <div className="max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div className="max-w-[90%] w-full">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                      <Quote className="w-3 h-3" /> Sources · click a timestamp to jump
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
              </div>
            ))
          )}

          {typing && (
            <div className="flex items-center gap-2">
              <OraLogo size={20} />
              <div className="flex gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={answersEndRef} />
        </div>
      </div>

      {/* Right: user questions + input */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">Your questions</span>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={searchAllLectures}
              onChange={(e) => setSearchAllLectures(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <BookOpen className="w-3.5 h-3.5" />
            Search all lectures
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
          {userMessages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500 text-center px-4">
              Type your question below and press send.
            </div>
          ) : (
            userMessages.map((m) => (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap bg-indigo-100 dark:bg-indigo-500/20 text-slate-800 dark:text-slate-100">
                  {m.content}
                </div>
              </div>
            ))
          )}
          <div ref={questionsEndRef} />
        </div>

        {/* Input box with chips */}
        <div className="px-6 pb-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-3">
            <div className="flex items-start gap-2">
              <textarea
                value={workspaceInput}
                onChange={(e) => setWorkspaceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendWorkspaceMessage();
                  }
                }}
                rows={1}
                placeholder={processing ? 'Processing video…' : 'Ask Ora anything about the video…'}
                className="flex-1 resize-none bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm outline-none py-1"
              />
              <button
                onClick={sendWorkspaceMessage}
                disabled={typing || !workspaceInput.trim()}
                className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <button
                onClick={openFilePicker}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-300 hover:bg-indigo-100 transition"
                title="Upload a video"
              >
                <Video className="w-3.5 h-3.5" />
                Upload Video
              </button>
              <button
                onClick={() => setShowUrlModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/20 dark:text-emerald-300 hover:bg-emerald-100 transition"
                title="Paste a YouTube or Google Drive link"
              >
                <Link className="w-3.5 h-3.5" />
                Paste Link
              </button>
              {INPUT_CHIPS.map((chip) => {
                const Icon = chip.icon;
                const isActive = activeChip === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setActiveChip(chip.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-300'
                        : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
