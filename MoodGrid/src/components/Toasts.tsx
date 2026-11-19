import { X } from 'lucide-react';
import { useStore } from '../store';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`sheet-up pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-full border px-4 py-2.5 text-[14px] font-medium shadow-2xl ${t.kind === 'error' ? 'border-[#e5534b]/50 bg-panel text-[#e5534b]' : 'border-line bg-panel text-ink'}`}>
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="font-bold text-mark hover:underline"
              onClick={() => {
                t.action?.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="닫기" className="text-faint hover:text-ink" onClick={() => dismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** 확인 창 (window.confirm 대신) */
export function AskDialog() {
  const ask = useStore((s) => s.ask);
  if (!ask) return null;
  return (
    <div className="fade-in fixed inset-0 z-[90] flex items-center justify-center bg-scrim p-6 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label={ask.title}>
      <div className="sheet-up w-full max-w-[400px] rounded-2xl border border-line bg-panel p-5 shadow-2xl">
        <h2 className="text-[17px] font-bold">{ask.title}</h2>
        {ask.body && <p className="mt-2 whitespace-pre-line text-[14px] text-mute">{ask.body}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="h-10 rounded-lg px-4 text-[14px] font-semibold text-mute hover:bg-raise hover:text-ink" onClick={() => ask.resolve(false)}>
            취소
          </button>
          <button type="button" data-autofocus autoFocus className={`h-10 rounded-lg px-4 text-[14px] font-semibold ${ask.danger ? 'bg-[#e5534b] text-white' : 'bg-ink text-bg'}`} onClick={() => ask.resolve(true)}>
            {ask.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
