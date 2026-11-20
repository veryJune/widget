// 공통 UI 조각
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Star, X } from 'lucide-react';
import type { Rating } from '../types';

export function IconButton({ label, active, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? 'bg-raise text-ink' : 'text-mute hover:bg-raise hover:text-ink'} disabled:opacity-40 ${className}`}
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

export const inputCls = 'h-11 w-full rounded-lg border border-line bg-bg px-3 text-[15px] text-ink placeholder:text-faint focus:border-mark focus:outline-none';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-mute">{label}</span>
      {children}
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-line bg-raise px-1.5 py-0.5 text-[12px] font-semibold text-mute">{children}</kbd>;
}

/** 가운데 창 (좁은 화면에서는 아래에서 올라옴) */
export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => (ref.current?.querySelector<HTMLElement>('[data-autofocus]') || ref.current)?.focus());
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fade-in fixed inset-0 z-[60] flex items-end justify-center bg-scrim backdrop-blur-sm sm:items-center sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} style={{ maxWidth: width }} className="sheet-up flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl outline-none sm:rounded-2xl">
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h2 className="text-[17px] font-bold">{title}</h2>
            <IconButton label="닫기" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** 별 1~3 — 칸 안에서 위아래 중앙 정렬, 마우스를 올린 별까지 미리 채워서 보여줌 */
export function Stars({ value, onChange, size = 16, className = '' }: { value: Rating; onChange?: (r: Rating) => void; size?: number; className?: string }) {
  const [hover, setHover] = useState(0);
  const shown = onChange && hover ? hover : value;
  return (
    <span className={`inline-flex items-center ${className}`} onMouseLeave={() => setHover(0)}>
      {([1, 2, 3] as Rating[]).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`별점 ${n}`}
          aria-pressed={value >= n}
          disabled={!onChange}
          onMouseEnter={() => setHover(n)}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(n);
          }}
          className={`flex items-center justify-center transition-transform ${onChange ? 'hover:scale-110' : 'cursor-default'}`}
          style={{ width: size + 8, height: size + 8 }}
        >
          <Star size={size} className={`block ${shown >= n ? 'fill-mark text-mark' : 'text-mute/60'}`} />
        </button>
      ))}
    </span>
  );
}
