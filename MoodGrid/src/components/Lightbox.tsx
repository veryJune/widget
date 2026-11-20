// 크게 보기: 필름스트립 · 휠/핀치 확대 · 더블클릭 100% · 키보드 별점 · 정보/메모 패널
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Info, Pause, Pin, Play, Trash2, X } from 'lucide-react';
import { useStore, viewOptsOf } from '../store';
import { buildView } from '../lib/order';
import { safeHttpUrl } from '../lib/util';
import type { Rating } from '../types';
import { IconButton, Stars } from './ui';

const MAX_K = 8;

export function Lightbox() {
  const viewerId = useStore((s) => s.viewerId);
  if (!viewerId) return null;
  return <Viewer />;
}

function Viewer() {
  const viewerId = useStore((s) => s.viewerId) as string;
  const items = useStore((s) => s.items);
  const projects = useStore((s) => s.projects);
  const currentId = useStore((s) => s.currentId);
  const filter = useStore((s) => s.filter);
  const query = useStore((s) => s.query);
  const colorFilter = useStore((s) => s.colorFilter);
  const kinds = useStore((s) => s.kinds);
  const cinema = useStore((s) => s.cinema);
  const slideshow = useStore((s) => s.slideshow);
  const urls = useStore((s) => s.urls);
  const previews = useStore((s) => s.previews);
  const act = useStore.getState;

  const images = useMemo(
    () => buildView(items, viewOptsOf({ projects, currentId, filter, query, colorFilter, kinds, cinema })).filter((i) => i.type === 'image' && i.path),
    [items, projects, currentId, filter, query, colorFilter, kinds, cinema],
  );
  const index = Math.max(0, images.findIndex((i) => i.id === viewerId));
  const item = images[index];

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  tRef.current = t;
  const [loaded, setLoaded] = useState(false);
  const [info, setInfo] = useState(() => window.innerWidth > 900);
  const [note, setNote] = useState('');

  const apply = useCallback((next: { k: number; x: number; y: number }) => {
    // 이미지가 화면 밖으로 너무 나가지 않게
    const st = stageRef.current;
    const im = imgRef.current;
    let { k, x, y } = next;
    k = Math.min(MAX_K, Math.max(1, k));
    if (st && im) {
      const mx = Math.max(0, (im.clientWidth * k - st.clientWidth) / 2) + 60;
      const my = Math.max(0, (im.clientHeight * k - st.clientHeight) / 2) + 60;
      x = k === 1 ? 0 : Math.min(mx, Math.max(-mx, x));
      y = k === 1 ? 0 : Math.min(my, Math.max(-my, y));
    }
    setT({ k, x, y });
  }, []);

  const zoomAt = useCallback((k2: number, px?: number, py?: number) => {
    const st = stageRef.current;
    const cur = tRef.current;
    const k = Math.min(MAX_K, Math.max(1, k2));
    if (!st) return apply({ ...cur, k });
    const r = st.getBoundingClientRect();
    const cx = (px ?? r.left + r.width / 2) - (r.left + r.width / 2);
    const cy = (py ?? r.top + r.height / 2) - (r.top + r.height / 2);
    const ratio = k / cur.k;
    apply({ k, x: cx - (cx - cur.x) * ratio, y: cy - (cy - cur.y) * ratio });
  }, [apply]);

  // 항목이 바뀌면 맞춤으로, 메모 초기화
  useEffect(() => {
    setT({ k: 1, x: 0, y: 0 });
    setLoaded(false);
    setNote(item?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // 사진 주소 준비: 지금 것 + 앞뒤 (미리 받아 두기)
  useEffect(() => {
    const near = [images[index - 1], images[index], images[index + 1]].filter(Boolean);
    act().ensureUrls(near.flatMap((i) => [i.path, i.thumb]));
    // 필름스트립용 썸네일은 보드에서 이미 요청됨
  }, [images, index, act]);
  useEffect(() => {
    for (const n of [images[index - 1], images[index + 1]]) {
      const u = n?.path ? urls[n.path] : null;
      if (u) new Image().src = u;
    }
  }, [images, index, urls]);

  // 필름스트립에서 현재 항목이 보이게
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [item?.id]);

  const go = useCallback((d: number) => {
    if (!images.length) return;
    const n = images[(index + d + images.length) % images.length];
    if (n) act().setViewer(n.id);
  }, [images, index, act]);
  const close = useCallback(() => {
    act().setSlideshow(false);
    act().setViewer(null);
  }, [act]);

  // 슬라이드쇼: 4초마다 다음 이미지 (Space 로 시작/멈춤)
  useEffect(() => {
    if (!slideshow || images.length < 2) return;
    const id = setInterval(() => go(1), 4000);
    return () => clearInterval(id);
  }, [slideshow, images.length, go]);

  // 이 항목이 사라지면(삭제 등) 이웃으로, 이웃이 없으면 닫기
  useEffect(() => {
    if (!item) {
      if (images.length) act().setViewer(images[Math.min(index, images.length - 1)].id);
      else close();
    }
  }, [item, images, index, act, close]);

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let handled = true;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') zoomAt(tRef.current.k * 1.4);
      else if (e.key === '-' || e.key === '_') zoomAt(tRef.current.k / 1.4);
      else if (e.key === '0') apply({ k: 1, x: 0, y: 0 });
      else if (e.key === 'i' || e.key === 'I') setInfo((v) => !v);
      else if (e.key === ' ') act().setSlideshow(!useStore.getState().slideshow);
      else if (e.key === '1' || e.key === '2' || e.key === '3') act().setRating([viewerId], Number(e.key) as Rating);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, go, zoomAt, apply, act, viewerId]);

  // 마우스 휠 확대 (스테이지에서 직접: passive 아님)
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(tRef.current.k * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
    };
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => st.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // 끌기(이동) · 두 손가락 확대 · 터치 스와이프
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean; dist: number; k0: number; sx: number; sy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    stageRef.current?.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cur = tRef.current;
    const two = [...pts.current.values()];
    gesture.current = { x: e.clientX, y: e.clientY, tx: cur.x, ty: cur.y, moved: false, dist: two.length === 2 ? Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y) : 0, k0: cur.k, sx: e.clientX, sy: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const two = [...pts.current.values()];
    if (two.length === 2) {
      const d = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
      if (!g.dist) g.dist = d;
      g.moved = true;
      zoomAt(g.k0 * (d / g.dist), (two[0].x + two[1].x) / 2, (two[0].y + two[1].y) / 2);
      return;
    }
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 4) g.moved = true;
    if (tRef.current.k > 1) apply({ k: tRef.current.k, x: g.tx + (e.clientX - g.x), y: g.ty + (e.clientY - g.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pts.current.delete(e.pointerId);
    if (!g) return;
    if (pts.current.size === 0) {
      gesture.current = null;
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (e.pointerType === 'touch' && tRef.current.k === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) return go(dx < 0 ? 1 : -1);
      // 이미지 바깥 빈 곳을 가볍게 누르면 닫기
      if (!g.moved && (e.target as HTMLElement) === stageRef.current) close();
    }
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const im = imgRef.current;
    if (!im) return;
    if (tRef.current.k > 1) return apply({ k: 1, x: 0, y: 0 });
    const actual = im.naturalWidth && im.clientWidth ? im.naturalWidth / im.clientWidth : 2;
    zoomAt(Math.max(2, Math.min(MAX_K, actual)), e.clientX, e.clientY);
  };

  if (!item) return null;
  const thumbSrc = (item.thumb && urls[item.thumb]) || previews[item.id];
  const fullSrc = item.path ? urls[item.path] : undefined;
  const added = new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div data-theme="dark" className="fade-in fixed inset-0 z-[70] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label="이미지 크게 보기">
      {/* 상단 */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <span className="num text-[14px] font-semibold text-white/80">
          {index + 1} <span className="text-white/40">/ {images.length}</span>
        </span>
        <span className="num rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] text-white/70">{Math.round(t.k * 100)}%</span>
        <div className="ml-auto flex items-center gap-1">
          <Stars value={item.rating} size={18} onChange={(r) => act().setRating([item.id], r)} className="mr-2" />
          {images.length > 1 && (
            <IconButton label={slideshow ? '슬라이드쇼 멈춤 (Space)' : '슬라이드쇼 (Space)'} active={slideshow} onClick={() => act().setSlideshow(!slideshow)} className="!text-white/80 hover:!bg-white/15">
              {slideshow ? <Pause size={18} /> : <Play size={18} />}
            </IconButton>
          )}
          <IconButton label="정보·메모 (I)" active={info} onClick={() => setInfo((v) => !v)} className="!text-white/80 hover:!bg-white/15">
            <Info size={18} />
          </IconButton>
          <IconButton label="닫기 (Esc)" onClick={close} className="!text-white/80 hover:!bg-white/15">
            <X size={20} />
          </IconButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 스테이지 */}
        <div
          ref={stageRef}
          className="relative flex min-w-0 flex-1 touch-none items-center justify-center overflow-hidden"
          style={{ cursor: t.k > 1 ? 'grab' : 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <div className="relative flex h-full w-full items-center justify-center" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transition: gesture.current ? 'none' : 'transform 120ms ease-out' }}>
            {thumbSrc && <img src={thumbSrc} alt="" draggable={false} className={`absolute max-h-[calc(100%-24px)] max-w-[calc(100%-24px)] select-none object-contain blur-[2px] transition-opacity ${loaded ? 'opacity-0' : 'opacity-100'}`} />}
            {fullSrc && <img ref={imgRef} key={item.id} src={fullSrc} alt={item.note || '이미지'} draggable={false} onLoad={() => setLoaded(true)} className={`relative max-h-[calc(100%-24px)] max-w-[calc(100%-24px)] select-none object-contain shadow-2xl transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`} />}
          </div>
          {images.length > 1 && (
            <>
              <button type="button" aria-label="이전 (←)" onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 md:flex">
                <ChevronLeft size={26} />
              </button>
              <button type="button" aria-label="다음 (→)" onClick={() => go(1)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 md:flex">
                <ChevronRight size={26} />
              </button>
            </>
          )}
        </div>

        {/* 정보 패널 */}
        {info && (
          <aside className="scroll-thin hidden w-[300px] shrink-0 overflow-y-auto border-l border-white/10 bg-black/40 p-5 md:block">
            <InfoPanel
              item={item}
              note={note}
              setNote={setNote}
              added={added}
              fullUrl={fullSrc}
              onCommit={() => note !== item.note && act().setNote(item.id, note)}
            />
          </aside>
        )}
      </div>

      {/* 필름스트립 */}
      {images.length > 1 && (
        <div ref={stripRef} className="no-scrollbar flex h-[76px] shrink-0 items-center gap-1.5 overflow-x-auto px-4 py-2" role="listbox" aria-label="이미지 목록">
          {images.map((im) => {
            const s = (im.thumb && urls[im.thumb]) || previews[im.id];
            const current = im.id === item.id;
            return (
              <button key={im.id} type="button" role="option" aria-selected={current} aria-current={current} aria-label={`${images.indexOf(im) + 1}번째 이미지`} onClick={() => act().setViewer(im.id)} className={`relative h-full shrink-0 overflow-hidden rounded-md transition ${current ? 'opacity-100 ring-2 ring-white' : 'opacity-50 hover:opacity-90'}`} style={{ aspectRatio: im.w && im.h ? String(Math.min(2, Math.max(0.6, im.w / im.h))) : '1' }}>
                {s ? <img src={s} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" /> : <div className="shimmer h-full w-full" />}
                {im.rating > 0 && <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-mark">★{im.rating}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoPanel({ item, note, setNote, added, fullUrl, onCommit }: { item: ReturnType<typeof useStore.getState>['items'][number]; note: string; setNote: (v: string) => void; added: string; fullUrl?: string; onCommit: () => void }) {
  const act = useStore.getState;
  return (
    <div className="space-y-5 text-[14px]">
      <section>
        <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">메모</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={onCommit}
          rows={5}
          maxLength={20000}
          placeholder="이 이미지에 대한 메모…"
          className="w-full resize-none rounded-lg border border-white/15 bg-white/5 p-3 text-[14px] leading-relaxed text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none"
        />
      </section>
      <section className="space-y-1.5 text-white/70">
        <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">정보</h3>
        {item.w && item.h && (
          <p className="num">
            {item.w} × {item.h} px
          </p>
        )}
        <p>추가한 날 {added}</p>
        {item.title && <p className="num">타임코드 {item.title}</p>}
        {item.content && (safeHttpUrl(item.content) ? (
          <p className="truncate">
            출처{' '}
            <a href={safeHttpUrl(item.content) as string} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              {item.content}
            </a>
          </p>
        ) : (
          <p className="truncate">출처 {item.content}</p>
        ))}
      </section>
      {item.colors.length > 0 && (
        <section>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">대표 색 (누르면 복사)</h3>
          <div className="flex flex-wrap gap-2">
            {item.colors.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`색 ${c} 복사`}
                onClick={() => {
                  void navigator.clipboard?.writeText(c).then(() => act().toast(`${c} 복사했습니다.`));
                }}
                className="group flex flex-col items-center gap-1"
              >
                <span className="block h-9 w-9 rounded-lg border border-white/15 transition group-hover:scale-110" style={{ background: c }} />
                <span className="num text-[10px] text-white/50">{c.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-wrap gap-2">
        <button type="button" onClick={() => act().togglePin([item.id])} className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition hover:bg-white/15 ${item.pinned ? 'bg-white/15 text-mark' : 'bg-white/8 text-white/80'}`}>
          <Pin size={14} /> {item.pinned ? '고정됨' : '고정'}
        </button>
        <button type="button" onClick={() => void act().downloadImage(item.id)} className="flex h-9 items-center gap-1.5 rounded-lg bg-white/8 px-3 text-[13px] font-semibold text-white/80 transition hover:bg-white/15">
          <Download size={14} /> 내려받기
        </button>
        {fullUrl && (
          <button type="button" onClick={() => window.open(fullUrl, '_blank', 'noopener,noreferrer')} className="flex h-9 items-center gap-1.5 rounded-lg bg-white/8 px-3 text-[13px] font-semibold text-white/80 transition hover:bg-white/15">
            <ExternalLink size={14} /> 원본 열기
          </button>
        )}
        <button type="button" onClick={() => act().deleteItems([item.id])} className="flex h-9 items-center gap-1.5 rounded-lg bg-white/8 px-3 text-[13px] font-semibold text-[#ff8a80] transition hover:bg-white/15">
          <Trash2 size={14} /> 삭제
        </button>
      </section>
    </div>
  );
}
