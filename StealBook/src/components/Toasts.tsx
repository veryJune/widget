import { Loader2, X } from 'lucide-react';
import { useStore } from '../store';

export function Toasts() {
  const { toasts, dismiss } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto sheet-up flex max-w-[min(92vw,520px)] items-center gap-3 rounded-xl px-4 py-2.5 text-[14px] font-semibold shadow-[0_12px_40px_rgba(0,0,0,0.4)] ${
            t.kind === 'error' ? 'bg-[#3a1d1d] text-[#ffd9d6]' : 'bg-ink text-bg'
          }`}
        >
          {t.kind === 'progress' && <Loader2 size={15} className="shrink-0 animate-spin" />}
          <span className="min-w-0 flex-1">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 underline underline-offset-4"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          {t.kind !== 'progress' && (
            <button type="button" aria-label="닫기" className="shrink-0 opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
