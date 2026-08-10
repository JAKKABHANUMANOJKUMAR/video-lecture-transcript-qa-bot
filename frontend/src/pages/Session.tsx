import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, Link2, PanelRight } from 'lucide-react';
import { api } from '../lib/api';
import {
  rag,
  mediaUrl,
  type IngestProgress,
  type QuerySource,
} from '../lib/rag';
import { cx } from '../lib/cx';
import { Button, Dialog, Field, Input, EmptyState, useToast } from '../components/ui';
import { LektaLogo } from '../components/LektaLogo';
import { Messages } from '../components/session/Messages';
import { Composer } from '../components/session/Composer';
import { SourceRail } from '../components/session/SourceRail';
import { ProcessingPipeline } from '../components/session/ProcessingPipeline';
import {
  ACTION_PROMPTS,
  isYouTubeOrDriveUrl,
  nextId,
  type ChatMessage,
  type ChatSession,
  type SessionIntent,
  type TranscriptInfo,
} from '../components/session/types';

export interface SessionProps {
  initialSession?: ChatSession | null;
  /** Handed over from the Desk / Library: start by ingesting or binding a lecture. */
  intent?: SessionIntent | null;
  onConsumeIntent?: () => void;
  /**
   * Publish the conversation upward. `previousId` reports the provisional id
   * this session used before the server assigned a real one.
   */
  onPersist: (session: ChatSession, previousId?: string) => void;
}

/**
 * The Session — Lekta's core workspace. Conversation in the center, the
 * lecture itself (video + transcript) in the Source rail on the right.
 */
export function Session({ initialSession, intent, onConsumeIntent, onPersist }: SessionProps) {
  const [sessionId, setSessionId] = useState(() => initialSession?.id ?? nextId('chat'));
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages ?? []);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [searchAll, setSearchAll] = useState(false);

  const [videoName, setVideoName] = useState(initialSession?.videoName ?? '');
  const [videoId, setVideoId] = useState<string | null>(initialSession?.videoId ?? null);
  const [mediaKey, setMediaKey] = useState<string | null>(initialSession?.mediaKey ?? null);
  const [videoUrl, setVideoUrl] = useState<string | null>(
    initialSession?.mediaKey ? mediaUrl(initialSession.mediaKey) : null,
  );
  const [transcriptId, setTranscriptId] = useState<string | null>(
    initialSession?.transcriptId ?? null,
  );
  const [transcript, setTranscript] = useState<TranscriptInfo | null>(
    initialSession?.transcript ?? null,
  );

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<IngestProgress>({
    percent: 0,
    stage: 'uploading',
    message: '',
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  const [railOpen, setRailOpen] = useState(false); // mobile drawer
  // The last citation jump — `n` bumps per click so the rail can acknowledge it.
  const [seekMark, setSeekMark] = useState<{ seconds: number; n: number }>({ seconds: 0, n: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const isSupportedMediaFile = (file: File) => {
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return [
      'mp4',
      'mov',
      'webm',
      'mkv',
      'avi',
      'mp3',
      'wav',
      'm4a',
      'aac',
      'flac',
      'ogg',
    ].includes(ext ?? '');
  };
  const pendingSeekRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const serverChatIdRef = useRef<string | null>(initialSession?.id ?? null);
  const syncBusyRef = useRef(false);

  /* ------------------------------------------------------------ helpers */

  const append = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    const withId = { ...msg, id: nextId() };
    setMessages((prev) => [...prev, withId]);
    return withId.id;
  }, []);

  const revokeBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => () => revokeBlob(), []);

  /* -------------------------------------------------------- persistence */

  // Local + backend persistence (v1 contract §2.9): fires on every material
  // change once the conversation exists. Backend sync is best-effort.
  useEffect(() => {
    if (messages.length === 0) return;
    const first = messages[0];
    const title = initialSession?.title || first.content.slice(0, 60) || 'New chat';
    const session: ChatSession = {
      id: sessionId,
      title,
      messages,
      videoName,
      videoId,
      mediaKey,
      step: 0,
      updatedAt: Date.now(),
      transcriptId,
      transcript,
    };
    onPersist(session);

    const body = {
      video_name: videoName || null,
      video_id: videoId,
      transcript_id: transcriptId,
      step: 0,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (syncBusyRef.current) return;
    syncBusyRef.current = true;
    (async () => {
      try {
        if (!serverChatIdRef.current) {
          // The name is set once, here — later saves leave it alone so a rename
          // from the sidebar isn't overwritten by the first message again.
          const created = await api.createChat({ ...body, title });
          serverChatIdRef.current = created.id;
          if (created.id !== sessionId) {
            const provisionalId = sessionId;
            setSessionId(created.id);
            onPersist({ ...session, id: created.id }, provisionalId);
          }
        } else {
          try {
            await api.updateChat(serverChatIdRef.current, body);
          } catch {
            const created = await api.createChat({ ...body, title });
            serverChatIdRef.current = created.id;
          }
        }
      } catch {
        /* offline backend must never break the conversation */
      } finally {
        syncBusyRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, videoName, videoId, mediaKey, transcriptId, transcript]);

  /* ------------------------------------------------------------- ingest */

  const runIngest = useCallback(
    async (kind: 'file' | 'url', payload: File | string) => {
      const isFile = kind === 'file';
      const file = isFile ? (payload as File) : null;
      const url = isFile ? null : (payload as string);

      if (isFile && file && !isSupportedMediaFile(file)) {
        toast('warn', 'Invalid format', 'Please upload a video or audio file.');
        return;
      }

      const label = isFile
        ? file!.name
        : isYouTubeOrDriveUrl(url!) === 'drive'
          ? 'Google Drive video'
          : 'YouTube video';

      setVideoName(label);
      setProcessing(true);
      setProgress({ percent: isFile ? 0 : 2, stage: isFile ? 'uploading' : 'downloading', message: isFile ? 'Uploading video…' : 'Submitting URL for download…' });
      append({
        role: 'user',
        content: isFile ? `Uploaded video: ${file!.name}` : `Shared link: ${url}`,
      });

      // Local preview while the upload runs.
      if (isFile) {
        revokeBlob();
        const blob = URL.createObjectURL(file!);
        blobUrlRef.current = blob;
        setVideoUrl(blob);
      }

      // Best-effort library record.
      let vid: string | null = null;
      try {
        const rec = await api.createVideo({
          title: label,
          size_mb: isFile ? Math.max(1, Math.round(file!.size / (1024 * 1024))) : 0,
          status: 'processing',
        });
        vid = rec.id;
        setVideoId(rec.id);
        setMediaKey(rec.id);
      } catch {
        /* record is optional */
      }

      try {
        const res = isFile
          ? await rag.ingestWithProgress(file!, setProgress, label, vid ?? undefined)
          : await rag.ingestUrlWithProgress(url!, setProgress, undefined, vid ?? undefined);

        // A link ingest only learns the real name once the download finishes —
        // adopt it so the session isn't stuck on "Google Drive video".
        const finalLabel = res.title?.trim() || label;
        if (finalLabel !== label) setVideoName(finalLabel);

        if (vid) {
          api
            .updateVideo(vid, {
              status: 'processed',
              duration_seconds: Math.round(res.duration_seconds),
              ...(finalLabel !== label ? { title: finalLabel } : {}),
            })
            .catch(() => {});
        }
        const key = res.media_key ?? vid ?? res.transcript_id;
        setMediaKey(key);
        revokeBlob();
        setVideoUrl(mediaUrl(key));
        setTranscriptId(res.transcript_id);
        setTranscript({
          id: res.transcript_id,
          language: res.language,
          durationSeconds: res.duration_seconds,
          numChunks: res.num_chunks,
        });
        const mins = Math.floor(res.duration_seconds / 60);
        const secs = Math.round(res.duration_seconds % 60);
        append({
          role: 'bot',
          content: `I've transcribed and indexed "${finalLabel}" (language: ${res.language.toUpperCase()}, length: ${mins}m ${secs}s, ${res.num_chunks} sections). Ask me anything about this video!`,
        });
      } catch (err) {
        if (vid) api.updateVideo(vid, { status: 'failed' }).catch(() => {});
        append({
          role: 'bot',
          content: `Couldn't process that video. ${err instanceof Error ? err.message : ''}`.trim(),
          isError: true,
        });
      } finally {
        setProcessing(false);
      }
    },
    [append],
  );

  const submitLink = () => {
    const url = linkUrl.trim();
    if (!isYouTubeOrDriveUrl(url)) {
      setLinkError('That link is not a YouTube or Google Drive URL.');
      return;
    }
    setLinkOpen(false);
    setLinkUrl('');
    setLinkError('');
    void runIngest('url', url);
  };

  /* ------------------------------------------------------------ ask/RAG */

  const ask = useCallback(
    async (question: string, displayText?: string, topK?: number) => {
      const text = question.trim();
      if (!text || typing) return;
      append({
        role: 'user',
        content: displayText ?? text,
        query: displayText === undefined ? text : undefined,
      });
      setInput('');
      setTyping(true);
      try {
        const res = await rag.query(text, {
          transcriptId: searchAll ? null : transcriptId,
          videoId: searchAll ? null : videoId,
          searchAll,
          topK,
        });
        append({ role: 'bot', content: res.answer, sources: res.sources });
        // A Library handoff knows the video but not the transcript — adopt it
        // from the first grounded answer so the transcript tab lights up.
        if (!transcriptId && !searchAll) {
          const src = res.sources.find((s) => s.transcript_id);
          if (src) setTranscriptId(src.transcript_id);
        }
      } catch (err) {
        append({
          role: 'bot',
          content: `Couldn't answer that. ${err instanceof Error ? err.message : ''}`.trim(),
          isError: true,
        });
      } finally {
        setTyping(false);
      }
    },
    [append, typing, searchAll, transcriptId, videoId],
  );

  const chip = (key: 'notes' | 'assistance') => {
    setActiveChip(key);
    void ask(
      ACTION_PROMPTS[key],
      key === 'notes' ? 'Generate notes' : 'I need assistance',
      key === 'notes' ? 12 : undefined,
    );
  };

  /* --------------------------------------------------- edit & regenerate */

  const regenerate = useCallback(
    async (botId: string, questionOverride?: string) => {
      let question = questionOverride ?? null;
      setMessages((prev) => {
        const botIdx = prev.findIndex((m) => m.id === botId);
        if (botIdx < 0) return prev;
        if (!question) {
          for (let i = botIdx - 1; i >= 0; i--) {
            const m = prev[i];
            if (m.role === 'user' && m.query !== undefined) {
              question = m.query;
              break;
            }
          }
        }
        if (!question) return prev; // e.g. answer to an upload event
        const copy = [...prev];
        copy[botIdx] = { ...copy[botIdx], pending: true, isError: false, content: '' };
        return copy;
      });
      if (!question) return;
      setTyping(true);
      try {
        const res = await rag.query(question, {
          transcriptId: searchAll ? null : transcriptId,
          videoId: searchAll ? null : videoId,
          searchAll,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? { ...m, pending: false, isError: false, content: res.answer, sources: res.sources }
              : m,
          ),
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? {
                  ...m,
                  pending: false,
                  isError: true,
                  sources: undefined,
                  content: `Couldn't answer that. ${err instanceof Error ? err.message : ''}`.trim(),
                }
              : m,
          ),
        );
      } finally {
        setTyping(false);
      }
    },
    [searchAll, transcriptId, videoId],
  );

  const saveEdit = useCallback(
    (userMsgId: string, newText: string) => {
      let pairedBotId: string | null = null;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === userMsgId);
        if (idx < 0) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], content: newText, query: newText };
        for (let i = idx + 1; i < copy.length; i++) {
          if (copy[i].role === 'bot') {
            pairedBotId = copy[i].id;
            break;
          }
        }
        if (!pairedBotId) {
          const bot: ChatMessage = { id: nextId(), role: 'bot', content: '', pending: true };
          copy.splice(idx + 1, 0, bot);
          pairedBotId = bot.id;
        }
        return copy;
      });
      // Defer so the pending flag lands before the query starts.
      window.setTimeout(() => {
        if (pairedBotId) void regenerate(pairedBotId, newText);
      }, 0);
    },
    [regenerate],
  );

  /* ------------------------------------------------------ citation seek */

  /**
   * Play the lecture from `seconds`. Assigning `currentTime` is silently
   * dropped while the element is still cold (`readyState` 0, no duration yet),
   * so in that case the jump is parked and replayed on `loadedmetadata`.
   */
  const playFrom = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v || v.readyState < 1) {
      pendingSeekRef.current = seconds;
      return;
    }
    v.currentTime = seconds;
    void v.play().catch(() => {});
    v.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const seekSource = useCallback(
    (s: QuerySource) => {
      const seconds = Math.max(0, s.start_seconds ?? 0);
      const targetKey = s.video_id ?? s.transcript_id;
      setRailOpen(true);
      setSeekMark((prev) => ({ seconds, n: prev.n + 1 }));
      if (targetKey && targetKey !== mediaKey) {
        // Cross-lecture jump (search-all): swap the player source first, then
        // let the loadedmetadata handler apply the seek to the new source.
        setMediaKey(targetKey);
        setVideoName(s.lecture_title || videoName);
        revokeBlob();
        setVideoUrl(mediaUrl(targetKey));
        pendingSeekRef.current = seconds;
        return;
      }
      playFrom(seconds);
    },
    [mediaKey, videoName, playFrom],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const applyPending = () => {
      const target = pendingSeekRef.current;
      if (target == null) return;
      pendingSeekRef.current = null;
      v.currentTime = target;
      void v.play().catch(() => {});
    };
    // Metadata may already be in by the time this effect runs.
    if (v.readyState >= 1) applyPending();
    v.addEventListener('loadedmetadata', applyPending);
    return () => v.removeEventListener('loadedmetadata', applyPending);
  }, [videoUrl]);

  /* ----------------------------------------------------- intent handoff */

  const intentDone = useRef(false);
  useEffect(() => {
    if (intentDone.current || !intent) return;
    intentDone.current = true;
    if (intent.file) void runIngest('file', intent.file);
    else if (intent.url) void runIngest('url', intent.url);
    else if (intent.lecture) {
      setVideoId(intent.lecture.id);
      setMediaKey(intent.lecture.id);
      setVideoName(intent.lecture.title);
      setVideoUrl(mediaUrl(intent.lecture.id));
    }
    onConsumeIntent?.();
  }, [intent, onConsumeIntent, runIngest]);

  /* ------------------------------------------------------------- render */

  const hasConversation = messages.length > 0;
  const typingLabel = transcript
    ? `Searching ${transcript.numChunks} sections…`
    : 'Thinking…';
  const showRail = hasConversation || videoUrl !== null || processing;

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-7xl flex-col gap-4 md:h-[calc(100dvh-4.5rem)] lg:flex-row lg:gap-6">
      {/* Conversation column */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Conversation">
        {showRail && (
          <div className="mb-2 flex items-center justify-end lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              icon={<PanelRight size={14} />}
              onClick={() => setRailOpen((v) => !v)}
            >
              {railOpen ? 'Hide lecture' : 'Show lecture'}
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pb-4 pr-1">
          {!hasConversation && !processing ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={<LektaLogo size={34} variant="ink" />}
                title={transcript ? 'Ask your first question' : 'Bring a lecture to the desk'}
                body={
                  transcript
                    ? 'The lecture is indexed and ready — ask anything, or generate notes below.'
                    : 'Upload a video or paste a YouTube / Drive link. Processing takes about a minute per 10 minutes of video.'
                }
                action={
                  !transcript ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <label>
                        <input
                          type="file"
                          accept="video/*,audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void runIngest('file', f);
                            e.target.value = '';
                          }}
                        />
                        <Button icon={<UploadCloud size={16} />} onClick={(e) => {
                          (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.click();
                        }}>
                          Upload a video
                        </Button>
                      </label>
                      <Button
                        variant="secondary"
                        icon={<Link2 size={16} />}
                        onClick={() => setLinkOpen(true)}
                      >
                        Paste a link
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 pt-2">
              {processing && (
                <ProcessingPipeline progress={progress} videoName={videoName} />
              )}
              <Messages
                messages={messages}
                typing={typing}
                typingLabel={typingLabel}
                onSeekSource={seekSource}
                onRegenerate={(id) => void regenerate(id)}
                onSaveEdit={saveEdit}
              />
            </div>
          )}
        </div>

        <Composer
          value={input}
          onChange={setInput}
          onSend={() => void ask(input)}
          onPickFile={(f) => void runIngest('file', f)}
          onPasteLink={() => setLinkOpen(true)}
          onChip={chip}
          activeChip={activeChip}
          typing={typing}
          processing={processing}
          hasTranscript={transcript !== null || transcriptId !== null}
          searchAll={searchAll}
          onSearchAll={setSearchAll}
        />
      </section>

      {/* Source rail */}
      {showRail && (
        <div
          className={cx(
            'min-h-0 lg:block lg:w-[360px] lg:shrink-0 xl:w-[400px]',
            railOpen ? 'block' : 'hidden',
          )}
        >
          <SourceRail
            videoUrl={videoUrl}
            videoName={videoName}
            transcript={transcript}
            transcriptId={transcriptId}
            videoRef={videoRef}
            seekMark={seekMark}
          />
        </div>
      )}

      {/* Link dialog */}
      <Dialog
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false);
          setLinkError('');
        }}
        title="Paste a lecture link"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitLink} disabled={!linkUrl.trim()}>
              Transcribe
            </Button>
          </>
        }
      >
        <Field
          label="YouTube or Google Drive URL"
          htmlFor="link-url"
          error={linkError || undefined}
          hint="Public YouTube videos, Shorts, or shared Drive files."
        >
          <Input
            id="link-url"
            autoFocus
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setLinkError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitLink();
            }}
            placeholder="https://youtube.com/watch?v=…"
          />
        </Field>
      </Dialog>
    </div>
  );
}
