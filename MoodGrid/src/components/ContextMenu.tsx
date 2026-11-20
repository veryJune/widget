// 카드 우클릭 메뉴: 크게 보기 · 별점 · 고정 · 메모 · 섹션으로 이동 · 비교 · 삭제
// 선택한 카드 위에서 열면 선택한 전체에, 아니면 그 카드 한 장에만 적용
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Columns2, ExternalLink, FolderInput, Maximize2, MessageSquare, Pencil, Pin, Play, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { liveSorted, sectionsOf } from '../lib/order';
import { safeHttpUrl } from '../lib/util';
import { parseVideo } from '../lib/video';
import { useClickAway } from '../hooks/useClickAway';
import { Stars } from './ui';

export function ContextMenu() {
  const m = useStore((s) => s.menu);
  if (!m) return null;
  return <Inner key={`${m.x},${m.y},${m.id}`} m={m} />;
}

function Item({ icon, label, hint, danger, onClick }: { icon: React.ReactNode; label: string; hint?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition hover:bg-raise ${danger ? 'text-[#e5534b]' : ''}`}>
      <span className={danger ? '' : 'text-mute'}>{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
    </button>
  );
}

function Inner({ m }: { m: NonNullable<ReturnType<typeof useStore.getState>['menu']> }) {
  const items = useStore((s) => s.items);
  const selection = useStore((s) => s.selection);
  const act = useStore.getState;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: m.x, y: m.y });
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const close = () => act().setMenu(null);
  useClickAway(ref, close, true);

  const item = items.find((i) => i.id === m.id && !i.deleted_at);
  const targets = useMemo(() => (selection.has(m.id) ? [...selection] : [m.id]), [selection, m.id]);
  const picked = useMemo(() => items.filter((i) => targets.includes(i.id) && !i.deleted_at), [items, targets]);
  const sections = useMemo(() => sectionsOf(liveSorted(items)), [items]);
  const imageIds = picked.filter((i) => i.type === 'image' && i.path).map((i) => i.id);

  // 화면 밖으로 나가지 않게 위치 보정
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(m.x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(m.y, window.innerHeight - r.height - 8)) });
  }, [m.x, m.y, sectionsOpen]);

  // Esc 는 메뉴만 닫음 (뒤의 선택 해제 같은 다른 Esc 동작이 함께 실행되지 않도록 가로챔)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      act().setMenu(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [act]);

  useEffect(() => {
    const off = () => act().setMenu(null);
    window.addEventListener('scroll', off, true);
    window.addEventListener('resize', off);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('scroll', off, true);
      window.removeEventListener('resize', off);
      window.removeEventListener('blur', off);
    };
  }, [act]);

  if (!item) return null;
  const single = picked.length === 1;
  const video = item.type === 'bookmark' ? parseVideo(item.content) || item.embed : null;
  const url = item.type === 'bookmark' ? safeHttpUrl(item.content) : null;
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const allPinned = picked.length > 0 && picked.every((i) => i.pinned);

  return (
    <div ref={ref} role="menu" aria-label="카드 메뉴" style={{ left: pos.x, top: pos.y }} className="fade-in fixed z-[75] w-[232px] rounded-xl border border-line bg-panel p-1.5 shadow-2xl">
      {!single && <p className="px-2.5 pb-1 pt-0.5 text-[12px] font-semibold text-faint">{picked.length}개 선택됨</p>}
      {single && item.type === 'image' && <Item icon={<Maximize2 size={15} />} label="크게 보기" hint="Space" onClick={run(() => act().setViewer(item.id))} />}
      {single && video && <Item icon={<Play size={15} />} label="재생" onClick={run(() => act().setVideoView({ kind: 'item', id: item.id }))} />}
      {single && url && <Item icon={<ExternalLink size={15} />} label="링크 열기" onClick={run(() => window.open(url, '_blank', 'noopener,noreferrer'))} />}
      {single && item.type === 'text' && <Item icon={<Pencil size={15} />} label="수정" onClick={run(() => act().setEditor({ mode: 'text', id: item.id }))} />}
      {single && item.type !== 'divider' && <Item icon={<MessageSquare size={15} />} label={item.note ? '메모 수정' : '메모 달기'} onClick={run(() => act().setEditor({ mode: 'note', id: item.id }))} />}

      <div className="flex items-center justify-between rounded-lg px-2.5 py-1">
        <span className="text-[13.5px] text-mute">별점</span>
        <Stars
          value={single ? item.rating : 0}
          size={17}
          onChange={(r) => {
            act().setRating(targets, r);
            close();
          }}
        />
      </div>
      <Item icon={<Pin size={15} />} label={allPinned ? '고정 해제' : '맨 위에 고정'} hint="P" onClick={run(() => act().togglePin(targets))} />
      {imageIds.length >= 2 && imageIds.length <= 4 && <Item icon={<Columns2 size={15} />} label={`선택한 ${imageIds.length}장 비교`} hint="C" onClick={run(() => act().openCompare(imageIds))} />}

      <button type="button" role="menuitem" aria-expanded={sectionsOpen} onClick={() => setSectionsOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition hover:bg-raise">
        <span className="text-mute">
          <FolderInput size={15} />
        </span>
        <span className="flex-1">섹션으로 이동</span>
        <ChevronRight size={14} className={`text-faint transition ${sectionsOpen ? 'rotate-90' : ''}`} />
      </button>
      {sectionsOpen && (
        <div className="mb-1 ml-3 max-h-48 overflow-y-auto border-l border-line pl-1.5 scroll-thin">
          {sections.map((s) => (
            <button
              key={s.divider?.id ?? 'top'}
              type="button"
              role="menuitem"
              onClick={run(() => act().moveToSection(targets.filter((id) => items.find((i) => i.id === id)?.type !== 'divider'), s.divider?.id ?? null))}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-raise"
            >
              <span className="truncate">{s.divider ? s.divider.content : '맨 위 (분류 없음)'}</span>
              <span className="num ml-2 text-[11.5px] text-faint">{s.items.length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="my-1 h-px bg-line" />
      <Item icon={<Trash2 size={15} />} label="삭제" hint="Delete" danger onClick={run(() => act().deleteItems(targets))} />
    </div>
  );
}
