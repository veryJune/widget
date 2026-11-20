// 비교 보기: 이미지 2~4장을 나란히 (확대 · 이동이 함께 움직임), 2장이면 A·B 슬라이더(와이프)로도
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Columns2, SplitSquareHorizontal, X } from 'lucide-react';
import { useStore } from '../store';
import type { Item } from '../types';
import { IconButton } from './ui';

const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_K = 8;

export function Compare() {
  const ids = useStore((s) => s.compareIds);
  if (!ids) return null;
  return <Inner />;
}

function Inner() {
  const ids = useStore((s) => s.compareIds) as string[];
  const items = useStore((s) => s.items);
  const urls = useStore((s) => s.urls);
  const previews = useStore((s) => s.previews);
  const act = useStore.getState;
  const panes = ids.map((id) => items.find((i) => i.id === id && !i.deleted_at)).filter((i): i is Item => !!i);
  const n = panes.length;

  const [mode, setMode] = useState<'side' | 'slider'>('side');
  const [split, setSplit] = useState(50);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  tRef.current = t;
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const close = useCallback(() => act().closeCompare(), [act]);

  // 이미지가 2장 미만이 되면(삭제 · 제거) 닫기
  useEffect(() => {
    if (n < 2) close();
  }, [n, close]);

  useEffect(() => {
    act().ensureUrls(panes.flatMap((i) => [i.path, i.thumb]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  const apply = useCallback((next: { k: number; x: number; y: number }) => {
    const st = stageRef.current;
    const k = Math.min(MAX_K, Math.max(1, next.k));
    const lim = (size: number) => (k === 1 ? 0 : ((k - 1) * size) / 2 + 40);
    const mx = lim(st?.clientWidth ?? 800);
    const my = lim(st?.clientHeight ?? 600);
    setT({ k, x: Math.min(mx, Math.max(-mx, next.x)), y: Math.min(my, Math.max(-my, next.y)) });
  }, []);

  const zoomAt = useCallback((k2: number, px: number | null, py: number | null, pane: Element | null) => {
    const cur = tRef.current;
    const k = Math.min(MAX_K, Math.max(1, k2));
    const r = (pane ?? stageRef.current)?.getBoundingClientRect();
    if (!r) return apply({ ...cur, k });
    const cx = (px ?? r.left + r.width / 2) - (r.left + r.width / 2);
    const cy = (py ?? r.top + r.height / 2) - (r.top + r.height / 2);
    const ratio = k / cur.k;
    apply({ k, x: cx - (cx - cur.x) * ratio, y: cy - (cy - cur.y) * ratio });
  }, [apply]);

  // 휠 확대 (스테이지에서 직접: passive 아님)
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(tRef.current.k * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY, (e.target as HTMLElement).closest('[data-pane]'));
    };
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => st.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let handled = true;
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') zoomAt(tRef.current.k * 1.4, null, null, null);
      else if (e.key === '-' || e.key === '_') zoomAt(tRef.current.k / 1.4, null, null, null);
      else if (e.key === '0') apply({ k: 1, x: 0, y: 0 });
      else if ((e.key === 's' || e.key === 'S') && n === 2) setMode((m) => (m === 'side' ? 'slider' : 'side'));
      else if ((e.key === 'x' || e.key === 'X') && n === 2) useStore.setState((s) => ({ compareIds: s.compareIds ? [...s.compareIds].reverse() : s.compareIds }));
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, zoomAt, apply, n]);

  const src = (i: Item) => (i.path && urls[i.path]) || (i.thumb && urls[i.thumb]) || previews[i.id];
  const imgStyle = { transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transition: drag.current ? 'none' : 'transform 90ms ease-out' };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,[data-handle]')) return;
    stageRef.current?.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: tRef.current.x, ty: tRef.current.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && tRef.current.k > 1) apply({ k: tRef.current.k, x: d.tx + e.clientX - d.x, y: d.ty + e.clientY - d.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const remove = (id: string) => useStore.setState((s) => ({ compareIds: s.compareIds ? s.compareIds.filter((x) => x !== id) : s.compareIds }));

  const caption = (i: Item, idx: number) => (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-24px)] items-center gap-2 rounded-full bg-black/65 py-1 pl-1 pr-3 text-[12.5px] text-white backdrop-blur-md">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-bold text-black">{LETTERS[idx]}</span>
      <span className="truncate">{i.title || i.note.slice(0, 40) || i.content.slice(0, 40) || '이미지'}</span>
      {i.rating > 0 && <span className="shrink-0 text-[#f2cf3d]">★{i.rating}</span>}
    </div>
  );

  if (n < 2) return null;
  const gridCls = n === 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-3' : 'grid-cols-2 grid-rows-2';

  return (
    <div data-theme="dark" className="fade-in fixed inset-0 z-[70] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label="이미지 비교">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="text-[15px] font-semibold">비교</span>
        <span className="num rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] text-white/70">{n}장</span>
        <span className="num rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] text-white/70">{Math.round(t.k * 100)}%</span>
        <div className="ml-auto flex items-center gap-1">
          {n === 2 && (
            <>
              <button type="button" onClick={() => setMode('side')} aria-pressed={mode === 'side'} className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition ${mode === 'side' ? 'bg-white/15' : 'text-white/60 hover:bg-white/10'}`}>
                <Columns2 size={15} /> 나란히
              </button>
              <button type="button" onClick={() => setMode('slider')} aria-pressed={mode === 'slider'} title="A·B 슬라이더 (S)" className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition ${mode === 'slider' ? 'bg-white/15' : 'text-white/60 hover:bg-white/10'}`}>
                <SplitSquareHorizontal size={15} /> 슬라이더
              </button>
              <IconButton label="A ↔ B 바꾸기 (X)" onClick={() => useStore.setState((s) => ({ compareIds: s.compareIds ? [...s.compareIds].reverse() : s.compareIds }))} className="!text-white/80 hover:!bg-white/15">
                <ArrowLeftRight size={17} />
              </IconButton>
            </>
          )}
          <IconButton label="닫기 (Esc)" onClick={close} className="!text-white/80 hover:!bg-white/15">
            <X size={20} />
          </IconButton>
        </div>
      </div>

      <div ref={stageRef} className="min-h-0 flex-1 touch-none select-none px-3 pb-3" style={{ cursor: t.k > 1 ? 'grab' : 'default' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={() => apply({ k: 1, x: 0, y: 0 })}>
        {mode === 'slider' && n === 2 ? (
          <div data-pane className="relative h-full w-full overflow-hidden rounded-xl bg-black">
            {/* B (아래) */}
            <img src={src(panes[1])} alt="B" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" style={imgStyle} />
            {/* A (위, 왼쪽 split% 만 보임) */}
            <img src={src(panes[0])} alt="A" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" style={{ ...imgStyle, clipPath: `inset(0 ${100 - split}% 0 0)` }} />
            <div
              data-handle
              role="slider"
              aria-label="A·B 경계"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(split)}
              tabIndex={0}
              className="absolute inset-y-0 z-20 w-8 -translate-x-1/2 cursor-ew-resize touch-none"
              style={{ left: `${split}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
                const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                setSplit(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setSplit((v) => Math.max(0, v - 2));
                if (e.key === 'ArrowRight') setSplit((v) => Math.min(100, v + 2));
              }}
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)]" />
              <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
                <ArrowLeftRight size={16} />
              </span>
            </div>
            <span className="pointer-events-none absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] font-bold text-black">A</span>
            <span className="pointer-events-none absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] font-bold text-black">B</span>
          </div>
        ) : (
          <div className={`grid h-full w-full gap-1.5 ${gridCls}`}>
            {panes.map((i, idx) => (
              <div key={i.id} data-pane className="relative min-h-0 overflow-hidden rounded-xl bg-black">
                <img src={src(i)} alt={LETTERS[idx]} draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" style={imgStyle} />
                {caption(i, idx)}
                {n > 2 && (
                  <button type="button" aria-label={`${LETTERS[idx]} 제거`} title="비교에서 빼기" onClick={() => remove(i.id)} className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white/80 backdrop-blur-md transition hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="shrink-0 pb-3 text-center text-[12px] text-white/35">
        휠로 확대 · 끌어서 이동 (모두 함께) · 더블클릭 맞춤{n === 2 ? ' · S 슬라이더 · X A↔B 바꾸기' : ''} · Esc 닫기
      </p>
    </div>
  );
}
