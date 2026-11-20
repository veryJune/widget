// 보드 위의 카드 한 장 (이미지 · 메모 · 링크) 과 섹션 헤더
import { memo, useLayoutEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Check, ChevronDown, ChevronRight, ChevronUp, ExternalLink, Link2, Loader2, MessageSquare, Pin, Play, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { dragState, hover } from '../ui';
import { domainOf, safeHttpUrl } from '../lib/util';
import { PROVIDER_LABEL, fmtStart, parseVideo } from '../lib/video';
import type { Item, TextColor } from '../types';
import { Stars } from './ui';

/** 카드 높이를 재서 grid-row-end: span N 을 넣는다 (행 높이 1px). 바뀐 크기만 비동기로 반영되므로 레이아웃을 강제로 다시 계산하지 않음 */
function useSpan(gap: number) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const body = bodyRef.current;
    if (!wrap || !body) return;
    const apply = (h: number) => {
      wrap.style.gridRowEnd = `span ${Math.max(1, Math.ceil(h + gap))}`;
    };
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) apply(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
    });
    ro.observe(body);
    return () => ro.disconnect();
  }, [gap]);
  return { wrapRef, bodyRef };
}

const TEXT_STYLE: Record<TextColor, string> = {
  white: 'bg-card text-ink',
  yellow: 'bg-[#FFF3B0] text-[#4a3d00]',
  blue: 'bg-[#DCEBFA] text-[#10375c]',
  green: 'bg-[#DDEFDF] text-[#16401c]',
  dark: 'bg-[#0f0f0f] text-[#f0f0f0]',
};

export interface CardCtx {
  gap: number;
  cols: number;
  /** 직접 정렬 + 필터 없음일 때만 끌어서 옮길 수 있음 */
  canDrag: boolean;
  /** 시네마틱 모드: 도구 · 배지 · 선택을 모두 숨기고 이미지만 */
  cinema: boolean;
  hint: 'before' | 'after' | null;
}

function CardBase({ item, ctx }: { item: Item; ctx: CardCtx }) {
  const { gap, cols, canDrag, hint, cinema } = ctx;
  const { wrapRef, bodyRef } = useSpan(gap);
  const selected = useStore((s) => s.selection.has(item.id));
  const selecting = useStore((s) => s.selection.size > 0 || s.selectMode);
  const useOriginal = cols <= 3 && !!item.path;
  const src = useStore((s) => (item.type === 'image' || item.thumb ? s.urls[(useOriginal ? item.path : item.thumb) ?? ''] ?? s.urls[item.thumb ?? ''] ?? s.previews[item.id] : undefined));
  const uploading = useStore((s) => !!s.uploading[item.id]);
  const act = useStore.getState;

  const drag = useDraggable({ id: item.id, disabled: !canDrag || uploading });
  const drop = useDroppable({ id: item.id });
  const setRefs = (el: HTMLDivElement | null) => {
    wrapRef.current = el;
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };

  const onClick = (e: React.MouseEvent) => {
    if (Date.now() - dragState.endedAt < 200) return; // 끌기를 마친 직후의 클릭은 무시
    const s = act();
    if (cinema && item.type !== 'image' && !(item.type === 'bookmark' && parseVideo(item.content))) return;
    if (!cinema && e.shiftKey && s.anchor) {
      e.preventDefault();
      s.select(rangeFromView(s.anchor, item.id), 'add');
      return;
    }
    if (!cinema && (e.ctrlKey || e.metaKey || s.selection.size > 0 || s.selectMode)) {
      s.select([item.id], 'toggle');
      return;
    }
    if (item.type === 'image') s.setViewer(item.id);
    else if (item.type === 'text' && !cinema) s.setEditor({ mode: 'text', id: item.id });
    else if (item.type === 'bookmark' && parseVideo(item.content)) s.setVideoView({ kind: 'item', id: item.id });
    else if (item.type === 'bookmark') {
      const u = safeHttpUrl(item.content);
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
      else s.toast('열 수 없는 주소입니다.', { kind: 'error' });
    }
  };

  const video = item.type === 'bookmark' ? parseVideo(item.content) : null;
  const hasNote = !!item.note.trim();
  const ratio = item.w && item.h ? item.w / item.h : undefined;
  const dragging = drag.isDragging;

  return (
    <div ref={setRefs} className="m-item" data-card data-id={item.id} onContextMenu={(e) => { if (cinema) return; e.preventDefault(); act().setMenu({ x: e.clientX, y: e.clientY, id: item.id }); }} onPointerEnter={() => (hover.id = item.id)} onPointerLeave={() => hover.id === item.id && (hover.id = null)} {...(canDrag ? drag.listeners : {})}>
      <div ref={bodyRef} className="relative">
        <div
          className={`card drop-in group relative cursor-pointer overflow-hidden rounded-2xl ${item.type === 'bookmark' || (item.type === 'text' && (item.color === 'white' || item.color === 'dark')) ? 'border border-line' : ''} ${dragging ? 'opacity-30' : ''} ${selected ? 'ring-2 ring-mark ring-offset-2 ring-offset-bg' : ''}`}
          data-selected={selected}
          tabIndex={0}
          role="button"
          aria-label={item.type === 'image' ? '이미지' : item.type === 'text' ? '메모' : '링크'}
          aria-pressed={selected}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onClick(e as unknown as React.MouseEvent);
            }
          }}
        >
          {item.type === 'image' && (
            <div className="relative w-full bg-raise" style={{ aspectRatio: ratio ? String(ratio) : '4 / 3' }}>
              {src ? <img src={src} alt={item.note || '이미지'} draggable={false} decoding="async" className="block h-full w-full select-none object-cover" /> : <div className="shimmer h-full w-full" />}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="animate-spin text-white" size={22} />
                </div>
              )}
            </div>
          )}

          {item.type === 'text' && (
            <div className={`note-text flex min-h-[120px] items-center justify-center p-6 text-center font-medium leading-snug ${TEXT_STYLE[item.color]}`} style={{ fontSize: item.content.length < 30 ? '1.5rem' : item.content.length < 140 ? '1.1rem' : '0.95rem' }}>
              {item.content}
            </div>
          )}

          {item.type === 'bookmark' && (
            <div className="bg-card">
              {(src || video) && (
                <div className={`relative w-full ${video ? 'bg-[#0f0f0f]' : 'bg-raise'}`} style={{ aspectRatio: video ? '16 / 9' : ratio ? String(ratio) : '16 / 9' }}>
                  {src && <img src={src} alt="" draggable={false} decoding="async" className="block h-full w-full object-cover" />}
                  {video && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-black/75">
                        <Play size={20} className="ml-0.5 fill-white" />
                      </span>
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-raise text-mute">{video ? <Play size={16} /> : <Link2 size={17} />}</div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[14px] font-bold leading-snug">{item.title || domainOf(item.content) || '링크'}</p>
                  <p className="mt-0.5 truncate text-[12px] text-mute">{video ? `${PROVIDER_LABEL[video.kind]}${video.start ? ` · ${fmtStart(video.start)}부터` : ''}` : item.content}</p>
                </div>
              </div>
            </div>
          )}

          {/* 상태 표시 */}
          {selected && (
            <span className="card-ui absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-mark text-on-mark shadow">
              <Check size={14} strokeWidth={3} />
            </span>
          )}
          {!selected && item.pinned && (
            <span className="card-ui absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-mark backdrop-blur-sm">
              <Pin size={12} />
            </span>
          )}
          {item.rating > 0 && (
            <span className="card-ui pointer-events-none absolute bottom-2 right-2 z-10 flex items-center gap-0.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
              <span className="text-mark">★</span>
              {item.rating}
            </span>
          )}
          {((item.type === 'image' && item.title) || (hasNote && !selecting)) && (
            <div className="card-ui pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1">
              {item.type === 'image' && item.title && <span className="num rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">{item.title}</span>}
              {hasNote && !selecting && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-mark backdrop-blur-sm">
                  <MessageSquare size={12} />
                </span>
              )}
            </div>
          )}

          {/* 메모는 아래에서 올라오는 자막처럼 */}
          {hasNote && (
            <div className="card-note card-ui pointer-events-none absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-hidden bg-gradient-to-t from-black/85 via-black/70 to-transparent px-4 pb-4 pt-10">
              <p className="note-text line-clamp-6 font-[family-name:var(--font-note)] text-[14px] leading-relaxed text-white/95">{item.note}</p>
            </div>
          )}

          {/* 도구 */}
          {!uploading && (
            <div className="card-tools card-ui absolute right-2 top-2 z-30 flex h-9 items-center gap-0.5 rounded-full tool-pill px-1 text-ink" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <ToolBtn label={item.pinned ? '고정 해제 (P)' : '맨 위에 고정 (P)'} active={item.pinned} onClick={() => act().togglePin([item.id])}>
                <Pin size={14} />
              </ToolBtn>
              <ToolBtn label="메모 (N 키는 새 메모)" active={hasNote} onClick={() => act().setEditor({ mode: 'note', id: item.id })}>
                <MessageSquare size={14} />
              </ToolBtn>
              {item.type === 'bookmark' && safeHttpUrl(item.content) && (
                <ToolBtn label="링크 열기" onClick={() => window.open(safeHttpUrl(item.content) as string, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink size={14} />
                </ToolBtn>
              )}
              <ToolBtn label="삭제 (Delete)" danger onClick={() => act().deleteItems([item.id])}>
                <Trash2 size={14} />
              </ToolBtn>
            </div>
          )}
          {!uploading && (
            <div className="card-tools card-ui absolute bottom-2 left-1/2 z-30 flex h-9 -translate-x-1/2 items-center rounded-full tool-pill px-1.5 text-ink" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <Stars value={item.rating} size={16} onChange={(r) => act().setRating([item.id], r)} />
            </div>
          )}
        </div>

        {/* 놓을 자리 표시 */}
        {hint && <span className="pointer-events-none absolute -inset-y-1 z-40 w-[3px] rounded-full bg-mark" style={{ [hint === 'before' ? 'left' : 'right']: 'calc(var(--gap, 24px) / -2 - 1.5px)' }} />}
      </div>
    </div>
  );
}

function ToolBtn({ label, active, danger, onClick, children }: { label: string; active?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  const tone = danger ? 'text-[#e5534b]/75 hover:bg-[#e5534b]/15 hover:text-[#e5534b]' : active ? 'text-mark hover:bg-raise' : 'text-mute hover:bg-raise hover:text-ink';
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${tone}`}>
      {children}
    </button>
  );
}

/** Shift 클릭 범위: 현재 화면 순서 기준 (Board 가 등록) */
let viewIdsGetter: () => string[] = () => [];
export function registerViewIds(fn: () => string[]) {
  viewIdsGetter = fn;
}
function rangeFromView(a: string, b: string): string[] {
  const ids = viewIdsGetter();
  const ia = ids.indexOf(a);
  const ib = ids.indexOf(b);
  if (ia < 0 || ib < 0) return [b];
  const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
  return ids.slice(lo, hi + 1);
}

export const Card = memo(CardBase, (a, b) => a.item === b.item && a.ctx.gap === b.ctx.gap && a.ctx.cols === b.ctx.cols && a.ctx.canDrag === b.ctx.canDrag && a.ctx.cinema === b.ctx.cinema && a.ctx.hint === b.ctx.hint);

// ---------- 섹션 헤더 ----------

export function SectionHeader({ item, count, canUp, canDown, dragOver }: { item: Item; count: number; canUp: boolean; canDown: boolean; dragOver: boolean }) {
  const { wrapRef, bodyRef } = useSpan(8);
  const drop = useDroppable({ id: `sec:${item.id}` });
  const act = useStore.getState;
  const [title, setTitle] = useState(item.content);
  const [editing, setEditing] = useState(false);
  if (!editing && title !== item.content) setTitle(item.content);

  const setRefs = (el: HTMLDivElement | null) => {
    wrapRef.current = el;
    drop.setNodeRef(el);
  };
  const commit = () => {
    setEditing(false);
    act().renameDivider(item.id, title);
  };

  return (
    <div ref={setRefs} className="m-item m-section" data-sec={item.id}>
      <div ref={bodyRef} className={`group flex items-center gap-3 rounded-xl py-3 transition-colors ${dragOver ? 'bg-mark/15 ring-2 ring-mark' : ''}`}>
        <button type="button" aria-label={item.collapsed ? '섹션 펼치기' : '섹션 접기'} aria-expanded={!item.collapsed} onClick={() => act().toggleCollapsed(item.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mute transition hover:bg-raise hover:text-ink">
          {item.collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
        </button>
        <div className="inline-grid min-w-0 max-w-[60vw]">
          <span aria-hidden className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre px-1.5 py-0.5 text-[15px] font-bold">{title || ' '}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setTitle(item.content);
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label="섹션 이름"
            size={1}
            className="col-start-1 row-start-1 w-full min-w-0 rounded-md bg-transparent px-1.5 py-0.5 text-[15px] font-bold text-ink hover:bg-raise focus:bg-raise focus:outline-none"
          />
        </div>
        <span className="num text-[13px] text-faint">{count}</span>
        <div className="h-px flex-1 bg-line" />
        <div className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <button type="button" aria-label="섹션을 위로" disabled={!canUp} onClick={() => act().moveSection(item.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full text-mute transition hover:bg-raise hover:text-ink disabled:opacity-30">
            <ChevronUp size={16} />
          </button>
          <button type="button" aria-label="섹션을 아래로" disabled={!canDown} onClick={() => act().moveSection(item.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-mute transition hover:bg-raise hover:text-ink disabled:opacity-30">
            <ChevronDown size={16} />
          </button>
          <button type="button" aria-label="섹션 구분선 삭제" onClick={() => act().deleteItems([item.id])} className="flex h-8 w-8 items-center justify-center rounded-full text-mute transition hover:bg-raise hover:text-[#e5534b]">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
