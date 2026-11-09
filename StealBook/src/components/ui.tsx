// 공통 UI 조각: 버튼, 모달/시트, 입력 등
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useCompact } from '../hooks/useMedia';

export function IconButton({ label, active, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-raise text-ink' : 'text-mute hover:bg-raise hover:text-ink'
      } disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Button({ variant = 'quiet', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-ink text-bg hover:opacity-90',
    quiet: 'bg-raise text-ink hover:bg-line',
    ghost: 'text-mute hover:text-ink hover:bg-raise',
    danger: 'bg-raise text-[#e5534b] hover:bg-line',
  }[variant];
  return (
    <button type="button" className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-[14px] font-semibold transition disabled:opacity-40 ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** 넓은 화면에선 가운데 창, 좁은 화면에선 아래에서 올라오는 시트 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 640,
  full = false,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** 모바일에서 화면 전체 사용 */
  full?: boolean;
  labelledBy?: string;
}) {
  const compact = useCompact();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus]') || ref.current;
      el?.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] fade-in md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`sheet-up flex w-full flex-col overflow-hidden bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.45)] outline-none ${
          compact ? (full ? 'h-[100dvh] rounded-none' : 'max-h-[92dvh] rounded-t-2xl') : 'max-h-[88vh] rounded-xl border border-line'
        }`}
        style={compact ? undefined : { maxWidth: width }}
      >
        {title !== undefined && (
          <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
            <h2 id={labelledBy} className="flex-1 text-[16px] font-bold">
              {title}
            </h2>
            <IconButton label="닫기" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="safe-bottom shrink-0 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[15px] text-ink placeholder:text-faint outline-none transition focus:border-ink/60';

export function Swatch({ color, size = 10, ring = false }: { color: string; size?: number; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: color, boxShadow: ring ? '0 0 0 1.5px var(--bg), 0 0 0 3px var(--mark)' : 'inset 0 0 0 1px rgba(127,127,127,0.35)' }}
    />
  );
}

/** 비율 모양 아이콘 (9:16, 1:1 …) */
export function RatioGlyph({ w, h, size = 14 }: { w: number; h: number; size?: number }) {
  const s = size / Math.max(w, h);
  return <span aria-hidden className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width: Math.max(5, w * s), height: Math.max(5, h * s) }} />;
}
