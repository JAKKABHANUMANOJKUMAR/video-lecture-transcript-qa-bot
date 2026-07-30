import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { cx } from '../../lib/cx';

type ToastTone = 'ok' | 'info' | 'warn' | 'danger';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastApi {
  toast: (tone: ToastTone, title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

const toneStyle: Record<ToastTone, { icon: React.ReactNode; bar: string }> = {
  ok: { icon: <CheckCircle2 size={18} className="text-ok" />, bar: 'bg-ok' },
  info: { icon: <Info size={18} className="text-info" />, bar: 'bg-info' },
  warn: { icon: <AlertTriangle size={18} className="text-warn" />, bar: 'bg-warn' },
  danger: { icon: <XCircle size={18} className="text-danger" />, bar: 'bg-danger' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (tone: ToastTone, title: string, body?: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, tone, title, body }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,360px)] flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card border border-line bg-surface p-3.5 pr-9 shadow-lg animate-rise"
          >
            <i className={cx('absolute inset-y-0 left-0 w-1', toneStyle[t.tone].bar)} />
            {toneStyle[t.tone].icon}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-cap text-ink-2">{t.body}</p>}
            </div>
            <button
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="absolute right-2 top-2 rounded-md p-1 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
