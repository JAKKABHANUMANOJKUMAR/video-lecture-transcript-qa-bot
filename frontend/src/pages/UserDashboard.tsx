import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  FileText,
  Sparkles,
  AudioLines,
  RotateCw,
  Video,
  Check,
} from 'lucide-react';

type Stage = 'welcome' | 'compose' | 'workspace';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  videoName: string;
  step: number;
  updatedAt: number;
}

interface UserDashboardProps {
  initialSession?: ChatSession | null;
  onPersist?: (session: ChatSession) => void;
}

const STEPS = ['Analysis', 'Planning', 'Review'];

const INPUT_CHIPS = [
  { id: 'notes', label: 'Generate Notes', icon: FileText },
  { id: 'assistance', label: 'Assistance', icon: Sparkles },
];

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

export const UserDashboard: React.FC<UserDashboardProps> = ({ initialSession, onPersist }) => {
  const [sessionId, setSessionId] = useState(() => initialSession?.id ?? Date.now().toString());
  const [stage, setStage] = useState<Stage>(initialSession ? 'workspace' : 'welcome');
  const [input, setInput] = useState('');
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages ?? []);
  const [step, setStep] = useState(initialSession?.step ?? 0);
  const [typing, setTyping] = useState(false);
  const [activeChip, setActiveChip] = useState('notes');
  const [videoName, setVideoName] = useState(initialSession?.videoName ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === 'workspace' && messages.length > 0 && onPersist) {
      onPersist({
        id: sessionId,
        title: messages[0]?.content?.slice(0, 60) || 'New chat',
        messages,
        videoName,
        step,
        updatedAt: Date.now(),
      });
    }
  }, [messages, step, videoName, stage, sessionId, onPersist]);

  const reset = () => {
    setSessionId(Date.now().toString());
    setStage('welcome');
    setInput('');
    setWorkspaceInput('');
    setMessages([]);
    setStep(0);
    setTyping(false);
    setActiveChip('notes');
    setVideoName('');
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVideoName(file.name);

    if (stage !== 'workspace') {
      // First upload starts the workspace flow at the Analysis step
      setMessages([
        { id: Date.now().toString(), role: 'user', content: `Generate notes for video: ${file.name}` },
      ]);
      setStage('workspace');
      setStep(0);
      setInput('');
      setTyping(true);
      setTimeout(() => setTyping(false), 1800);
    } else {
      // Subsequent upload advances to the next step
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: `Uploaded new video: ${file.name}` },
      ]);
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
      setTyping(true);
      setTimeout(() => setTyping(false), 1800);
    }
  };

  const startWorkspace = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    setMessages([{ id: Date.now().toString(), role: 'user', content: text }]);
    setStage('workspace');
    setInput('');
    setTyping(true);
    setTimeout(() => setTyping(false), 1800);
  };

  const sendWorkspaceMessage = () => {
    const text = workspaceInput.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    setWorkspaceInput('');
    setTyping(true);
    setTimeout(() => setTyping(false), 1800);
  };

  // ---------- Welcome + Compose (shared centered layout) ----------
  if (stage === 'welcome' || stage === 'compose') {
    return (
      <div className="relative h-full bg-white dark:bg-slate-900 flex flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
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
                  placeholder="Generate notes"
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
        accept="video/*"
        className="hidden"
        onChange={handleVideoSelected}
      />
      {/* Left: workspace */}
      <div className="flex flex-col border-r border-slate-200 dark:border-slate-700 p-6 overflow-y-auto">
        {videoName && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-sm text-indigo-700 dark:text-indigo-300 w-fit">
            <Video className="w-4 h-4" />
            <span className="font-medium truncate max-w-xs">{videoName}</span>
          </div>
        )}
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => {
            const completed = i < step;
            const active = i === step;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition ${
                      completed || active
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      active
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className={`w-16 h-px ${
                      i < step ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Skeleton content cards */}
        <div className="space-y-5 flex-1">
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3"
            >
              {[0, 1, 2].map((line) => (
                <div
                  key={line}
                  className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"
                  style={{ width: `${[95, 88, 70][line]}%` }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Previous / Next */}
        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-5 py-2 rounded-full text-sm font-medium text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={step === STEPS.length - 1}
            className="px-6 py-2 rounded-full text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* Right: Ora chat panel */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <OraLogo size={28} />
            <span className="text-2xl font-extrabold text-indigo-500 tracking-tight">Ora</span>
          </div>
          <ResetButton onClick={reset} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-end gap-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-slate-800 dark:text-slate-100'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

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
                placeholder="Ask Ora anything..."
                className="flex-1 resize-none bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm outline-none py-1"
              />
              <button
                onClick={sendWorkspaceMessage}
                className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
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
