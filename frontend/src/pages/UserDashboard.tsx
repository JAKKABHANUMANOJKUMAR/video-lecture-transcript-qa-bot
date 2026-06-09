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
} from 'lucide-react';
import { rag, RagError } from '../lib/rag';

type Stage = 'welcome' | 'compose' | 'workspace';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
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

export const UserDashboard: React.FC<UserDashboardProps> = ({ initialSession, onPersist }) => {
  const [sessionId, setSessionId] = useState(() => initialSession?.id ?? makeId());
  const [stage, setStage] = useState<Stage>(initialSession ? 'workspace' : 'welcome');
  const [input, setInput] = useState('');
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages ?? []);
  const [typing, setTyping] = useState(false);
  const [activeChip, setActiveChip] = useState('notes');
  const [videoName, setVideoName] = useState(initialSession?.videoName ?? '');
  const [transcriptId, setTranscriptId] = useState<string | null>(
    initialSession?.transcriptId ?? null,
  );
  const [transcript, setTranscript] = useState<TranscriptInfo | null>(
    initialSession?.transcript ?? null,
  );
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const answersEndRef = useRef<HTMLDivElement>(null);
  const questionsEndRef = useRef<HTMLDivElement>(null);

  const userMessages = messages.filter((m) => m.role === 'user');
  const botMessages = messages.filter((m) => m.role === 'bot');

  useEffect(() => {
    answersEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [botMessages, typing]);

  useEffect(() => {
    questionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [userMessages]);

  useEffect(() => {
    if (stage === 'workspace' && messages.length > 0 && onPersist) {
      onPersist({
        id: sessionId,
        title: messages[0]?.content?.slice(0, 60) || 'New chat',
        messages,
        videoName,
        step: 0,
        updatedAt: Date.now(),
        transcriptId,
        transcript,
      });
    }
  }, [messages, videoName, stage, sessionId, transcriptId, transcript, onPersist]);

  const reset = () => {
    setSessionId(makeId());
    setStage('welcome');
    setInput('');
    setWorkspaceInput('');
    setMessages([]);
    setTyping(false);
    setActiveChip('notes');
    setVideoName('');
    setTranscriptId(null);
    setTranscript(null);
    setProcessing(false);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const appendMessage = (role: ChatMessage['role'], content: string) => {
    setMessages((prev) => [...prev, { id: makeId(), role, content }]);
  };

  const handleVideoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setVideoName(file.name);
    setStage('workspace');
    appendMessage('user', `Uploaded video: ${file.name}`);
    setProcessing(true);
    setTyping(true);

    try {
      const res = await rag.ingest(file, file.name);
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
      const msg =
        err instanceof RagError
          ? err.message
          : 'Something went wrong while processing the video.';
      appendMessage('bot', `Sorry, I couldn't process that video. ${msg}`);
    } finally {
      setProcessing(false);
      setTyping(false);
    }
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || typing) return;

    setStage('workspace');
    appendMessage('user', text);
    setTyping(true);

    try {
      const res = await rag.query(text, transcriptId);
      appendMessage('bot', res.answer);
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

          {/* Action buttons */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => {
                setStage('compose');
                setInput('Generate notes');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <FileText className="w-4 h-4 text-sky-500" />
              To Generate Note
            </button>
            <button
              onClick={() => {
                setStage('compose');
                setInput('I need assistance');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <Sparkles className="w-4 h-4 text-amber-400 fill-amber-300" />
              For Assistance
            </button>
          </div>

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
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {processing && botMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Transcribing &amp; indexing your video…
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Your answer will appear here once processing completes.
                </p>
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
                <button
                  onClick={openFilePicker}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition"
                >
                  <Video className="w-4 h-4" />
                  Upload Video
                </button>
              )}
            </div>
          ) : (
            botMessages.map((m) => (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                  {m.content}
                </div>
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
