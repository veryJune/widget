// 보드: 메이슨리 배치 + 끌어서 옮기기 + 박스 선택
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { ArrowUp, ImagePlus, Layers } from 'lucide-react';
import { useStore } from '../store';
import { buildView, liveSorted, sectionsOf } from '../lib/order';
import { dragState } from '../ui';
import { Card, SectionHeader, registerViewIds } from './Card';

const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCenter(args);
};

function pointOf(e: Event | null | undefined): { x: number; y: number } | null {
  if (!e) return null;
  if ('clientX' in e) return { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY };
  const t = (e as TouchEvent).touches?.[0] ?? (e as TouchEvent).changedTouches?.[0];
  return t ? { x: t.clientX, y: t.clientY } : null;
}

function TopZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'zone:top' });
  if (!active) return null;
  return (
    <div ref={setNodeRef} className={`fixed left-1/2 top-[72px] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold shadow-xl backdrop-blur ${isOver ? 'border-mark bg-mark text-on-mark' : 'border-line bg-panel/90 text-mute'}`}>
      <ArrowUp size={14} /> 맨 위(분류 없음)로
    </div>
  );
}

/** 화면이 좁으면 설정한 열 수보다 적게 (카드 한 장이 최소 150px 은 되도록) */
function useFitCols(cols: number): number {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return Math.min(cols, Math.max(2, Math.floor((w - 32) / 150)));
}

export function Board() {
  const items = useStore((s) => s.items);
  const project = useStore((s) => s.projects.find((p) => p.id === s.currentId));
  const filter = useStore((s) => s.filter);
  const loading = useStore((s) => s.loadingItems);
  const selection = useStore((s) => s.selection);
  const focusId = useStore((s) => s.focusId);
  const uploadingCount = useStore((s) => Object.keys(s.uploading).length);
  const act = useStore.getState;

  const sort = project?.sort_mode ?? 'manual';
  const cols = useFitCols(project?.cols ?? 5);
  const gap = project?.gap ?? 24;
  const manual = sort === 'manual';

  const view = useMemo(() => buildView(items, { sort, minRating: filter }), [items, sort, filter]);
  const ordered = useMemo(() => liveSorted(items), [items]);
  const sections = useMemo(() => sectionsOf(ordered), [ordered]);
  const hasSections = sections.length > 1;
  const sectionIdx = useMemo(() => new Map(sections.map((s, i) => [s.divider?.id ?? '', i])), [sections]);

  useEffect(() => {
    registerViewIds(() => view.filter((i) => i.type !== 'divider').map((i) => i.id));
  }, [view]);

  // 보이는 항목의 사진 주소 준비 (많이 보이는 열 수에 맞춰 썸네일 또는 원본)
  useEffect(() => {
    const uploading = act().uploading;
    act().ensureUrls(view.filter((i) => !uploading[i.id]).flatMap((i) => (cols <= 3 ? [i.path, i.thumb] : [i.thumb])));
  }, [view, cols, act, uploadingCount]);

  // 새로 추가한 항목이 화면 밖이면 보이게
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      useStore.setState({ focusId: null });
    }, 120);
    return () => clearTimeout(t);
  }, [focusId]);

  // ----- 끌어서 옮기기 -----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const [overSec, setOverSec] = useState<string | null>(null);
  const hintRef = useRef<{ over: string | null; side: 'before' | 'after' }>({ over: null, side: 'before' });
  const startPt = useRef<{ x: number; y: number } | null>(null);

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    startPt.current = pointOf(e.activatorEvent);
  };
  const onDragMove = (e: DragMoveEvent) => {
    const over = e.over;
    const sp = startPt.current;
    if (!over || !sp) {
      hintRef.current = { over: null, side: 'before' };
      setHint(null);
      setOverSec(null);
      return;
    }
    const id = String(over.id);
    hintRef.current = { over: id, side: 'before' };
    if (id.startsWith('sec:')) {
      setHint(null);
      setOverSec(id.slice(4));
      return;
    }
    setOverSec(null);
    if (id.startsWith('zone:') || id === String(e.active.id)) {
      setHint(null);
      return;
    }
    const x = sp.x + e.delta.x;
    const side = x < over.rect.left + over.rect.width / 2 ? 'before' : 'after';
    hintRef.current = { over: id, side };
    setHint((h) => (h && h.id === id && h.side === side ? h : { id, side }));
  };
  const clearDrag = () => {
    setActiveId(null);
    setHint(null);
    setOverSec(null);
    dragState.endedAt = Date.now();
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { over, side } = hintRef.current;
    const active = String(e.active.id);
    clearDrag();
    if (!over) return;
    const s = act();
    const ids = s.selection.has(active) ? [...s.selection] : [active];
    if (over.startsWith('sec:')) s.moveToSection(ids, over.slice(4));
    else if (over === 'zone:top') s.moveToSection(ids, null);
    else s.moveItems(ids, { kind: side, id: over });
    hintRef.current = { over: null, side: 'before' };
  };

  // ----- 박스 선택 (빈 곳에서 끌기) -----
  const [box, setBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    if ((e.target as HTMLElement).closest('[data-card],[data-sec],button,input,textarea,a')) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const base = additive ? new Set(act().selection) : new Set<string>();
    let moved = false;
    let raf = 0;
    const update = (cx: number, cy: number) => {
      const r = { x1: Math.min(sx, cx), y1: Math.min(sy, cy), x2: Math.max(sx, cx), y2: Math.max(sy, cy) };
      setBox(r);
      const hits: string[] = [];
      document.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.right >= r.x1 && b.left <= r.x2 && b.bottom >= r.y1 && b.top <= r.y2) hits.push(el.dataset.id as string);
      });
      act().select([...base, ...hits], 'replace');
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      moved = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => update(ev.clientX, ev.clientY));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cancelAnimationFrame(raf);
      setBox(null);
      if (!moved && !additive) act().clearSelection();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
  const dragCount = activeId && selection.has(activeId) ? selection.size : 1;
  const ghostSrc = useStore((s) => (activeItem ? s.urls[activeItem.thumb ?? ''] ?? s.previews[activeItem.id] : undefined));

  const visibleCards = view.filter((i) => i.type !== 'divider').length;
  const totalLive = ordered.filter((i) => i.type !== 'divider').length;

  return (
    <div className="relative min-h-full px-4 pb-40 pt-6 md:px-10" onPointerDown={onPointerDown} style={{ ['--cols' as string]: cols, ['--gap' as string]: `${gap}px` }}>
      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={clearDrag}>
        <TopZone active={!!activeId && hasSections && manual} />
        <div className="masonry mx-auto max-w-[2400px]">
          {view.map((it) => {
            if (it.type === 'divider') {
              const idx = sectionIdx.get(it.id) ?? 0;
              return <SectionHeader key={it.id} item={it} count={sections[idx]?.items.length ?? 0} canUp={idx > 1} canDown={idx < sections.length - 1} dragOver={overSec === it.id} />;
            }
            return <Card key={it.id} item={it} ctx={{ gap, cols, canDrag: manual, hint: hint?.id === it.id ? hint.side : null }} />;
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem && (
            <div className="relative w-[150px] rotate-2 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
              {ghostSrc ? <img src={ghostSrc} alt="" className="block w-full" draggable={false} /> : <div className="flex min-h-[80px] items-center justify-center p-3 text-center text-[12px] text-mute">{activeItem.content.slice(0, 40)}</div>}
              {dragCount > 1 && <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-mark px-1.5 text-[12px] font-bold text-on-mark">{dragCount}</span>}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {loading && (
        <div className="masonry mx-auto max-w-[2400px]" aria-busy="true">
          {Array.from({ length: cols * 2 }).map((_, i) => (
            <div key={i} className="shimmer mb-6 rounded-2xl" style={{ height: 160 + ((i * 53) % 160) }} />
          ))}
        </div>
      )}

      {!loading && totalLive === 0 && (
        <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
          <div className="fade-in flex flex-col items-center rounded-3xl border border-line bg-panel/60 px-12 py-10 text-center">
            <Layers size={44} className="mb-4 text-faint" />
            <p className="text-[17px] font-semibold">비어 있는 보드</p>
            <p className="mt-2 text-[14px] text-mute">이미지를 끌어다 놓거나 <b className="text-ink">Ctrl+V</b> 로 붙여넣으세요.</p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-faint">
              <ImagePlus size={14} /> 링크 · 글 · 여러 장도 한 번에
            </p>
          </div>
        </div>
      )}
      {!loading && totalLive > 0 && visibleCards === 0 && (
        <p className="py-24 text-center text-[15px] text-mute">조건에 맞는 항목이 없습니다.</p>
      )}

      {box && <div className="pointer-events-none fixed z-50 rounded-sm border border-mark bg-mark/15" style={{ left: box.x1, top: box.y1, width: box.x2 - box.x1, height: box.y2 - box.y1 }} />}
    </div>
  );
}
