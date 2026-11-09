// 시어터 모드: 지금 보고 있는 목록을 전체 화면 슬라이드로 감상
// 이미지·메모는 6초, 영상은 끝까지 재생 후 다음. ← → 이동, Space 멈춤, Esc 닫기
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useStore } from '../store';
import { useBackClose } from '../hooks/useBackClose';
import { useVisibleItems } from '../hooks/useVisible';
import type { Item } from '../lib/types';
import { useUrl } from '../lib/urls';
import { titleOf } from '../lib/capture';

const STILL_MS = 6000;

function Slide({ item, playing, onEnded }: { item: Item; playing: boolean; onEnded: () => void }) {
  const m = item.media[0];
  const full = useUrl(m?.kind === 'image' ? m.path : null);
  const cover = useUrl(item.cover);
  const video = useUrl(m?.kind === 'video' ? m.path : null);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, video]);

  if (m?.kind === 'video' && video) {
    return <video ref={ref} key={video} src={video} muted autoPlay playsInline onEnded={onEnded} className="max-h-full max-w-full" />;
  }
  if (item.embed && !m) {
    const e = item.embed;
    return (
      <iframe
        key={item.id}
        src={e.embedUrl}
        title={titleOf(item)}
        className="rounded-md bg-black"
        style={e.fixedHeight ? { width: 'min(92vw, 560px)', height: e.fixedHeight } : { aspectRatio: String(e.aspect), height: e.aspect < 1 ? '88vh' : undefined, width: e.aspect >= 1 ? 'min(92vw, 1400px)' : undefined, maxHeight: '88vh', maxWidth: '92vw' }}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
    );
  }
  const src = full || cover;
  if (src) return <img key={src} src={src} alt="" referrerPolicy="no-referrer" className="fade-in max-h-full max-w-full object-contain" />;
  return <p className="note-text max-w-[60ch] text-[clamp(20px,2.6vw,34px)] font-semibold leading-[1.6] text-white">{item.body || titleOf(item)}</p>;
}

export function Theater() {
  const { theater, set } = useStore();
  const list = useVisibleItems();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [chrome, setChrome] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    set({ theater: { open: false, startId: null } });
  }, [set]);

  useBackClose(theater.open, close);

  useEffect(() => {
    if (!theater.open) return;
    const start = theater.startId ? list.findIndex((x) => x.id === theater.startId) : 0;
    setI(Math.max(0, start));
    setPlaying(true);
    root.current?.requestFullscreen?.().catch(() => {});
    const onFs = () => !document.fullscreenElement && set({ theater: { open: false, startId: null } });
    const t = setTimeout(() => document.addEventListener('fullscreenchange', onFs), 300);
    return () => {
      clearTimeout(t);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [theater.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = list[i];
  const next = useCallback(() => setI((x) => (list.length ? (x + 1) % list.length : 0)), [list.length]);
  const prev = useCallback(() => setI((x) => (list.length ? (x - 1 + list.length) % list.length : 0)), [list.length]);

  // 이미지·메모는 일정 시간 후 다음으로 (영상은 끝나면 / 임베드는 직접 넘김)
  useEffect(() => {
    if (!theater.open || !playing || !item) return;
    const m = item.media[0];
    if (m?.kind === 'video' || (item.embed && !m)) return;
    const t = setTimeout(next, STILL_MS);
    return () => clearTimeout(t);
  }, [theater.open, playing, item, next]);

  useEffect(() => {
    if (!theater.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [theater.open, close, next, prev]);

  const poke = () => {
    setChrome(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setChrome(false), 2200);
  };

  if (!theater.open) return null;

  return (
    <div ref={root} className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-white" onMouseMove={poke} onClick={poke} role="dialog" aria-modal="true" aria-label="시어터">
      {item ? (
        <div className="flex h-full w-full items-center justify-center p-[3vh]">
          <Slide item={item} playing={playing} onEnded={next} />
        </div>
      ) : (
        <p className="text-white/70">보여줄 항목이 없습니다.</p>
      )}

      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${chrome ? 'opacity-100' : 'opacity-0'}`}>
        <div className="pointer-events-auto absolute right-4 top-4 flex gap-2">
          <button type="button" aria-label={playing ? '멈춤 (Space)' : '재생 (Space)'} onClick={() => setPlaying((p) => !p)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" aria-label="닫기 (Esc)" onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
        <button type="button" aria-label="이전" onClick={prev} className="pointer-events-auto absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <ChevronLeft size={22} />
        </button>
        <button type="button" aria-label="다음" onClick={next} className="pointer-events-auto absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <ChevronRight size={22} />
        </button>
        {item && (
          <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold">{titleOf(item)}</p>
              {item.why && <p className="truncate text-[13px] text-white/70">{item.why}</p>}
            </div>
            <span className="num shrink-0 text-[13px] text-white/60">
              {i + 1} / {list.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
