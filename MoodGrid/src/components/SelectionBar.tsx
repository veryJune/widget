// 항목을 선택하면 아래에 뜨는 막대: 별점 · 고정 · 섹션으로 이동 · 삭제
import { useMemo, useRef, useState } from 'react';
import { ArrowRightToLine, ChevronUp, Columns2, Pin, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { liveSorted, sectionsOf } from '../lib/order';
import { useClickAway } from '../hooks/useClickAway';
import { Stars } from './ui';

export function SelectionBar() {
  const selection = useStore((s) => s.selection);
  const selectMode = useStore((s) => s.selectMode);
  const items = useStore((s) => s.items);
  const sort = useStore((s) => s.projects.find((p) => p.id === s.currentId)?.sort_mode ?? 'manual');
  const act = useStore.getState;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, () => setOpen(false), open);

  const ids = useMemo(() => [...selection], [selection]);
  const picked = useMemo(() => items.filter((i) => selection.has(i.id) && !i.deleted_at), [items, selection]);
  const sections = useMemo(() => sectionsOf(liveSorted(items)), [items]);
  const same = picked.length > 0 && picked.every((i) => i.rating === picked[0].rating) ? picked[0].rating : 0;
  const pinnedAll = picked.length > 0 && picked.every((i) => i.pinned);
  const imageIds = picked.filter((i) => i.type === 'image' && i.path).map((i) => i.id);

  if (!selectMode && selection.size === 0) return null;

  return (
    <div ref={ref} className="sheet-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-3">
      {open && (
        <div className="fade-in absolute bottom-full left-1/2 mb-2 max-h-[50vh] w-60 -translate-x-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-2xl scroll-thin">
          <p className="px-3 py-1.5 text-[12px] font-semibold text-faint">이동할 섹션 (맨 위로 들어감)</p>
          {sections.map((s) => (
            <button
              key={s.divider?.id ?? 'top'}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] hover:bg-raise"
              onClick={() => {
                act().moveToSection(ids, s.divider?.id ?? null);
                setOpen(false);
              }}
            >
              <span className="truncate">{s.divider ? s.divider.content : '맨 위 (분류 없음)'}</span>
              <span className="num ml-2 text-[12px] text-faint">{s.items.length}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 rounded-full border border-line bg-panel/95 px-3 py-2 shadow-2xl backdrop-blur" role="toolbar" aria-label="선택한 항목 작업">
        <span className="num px-2 text-[14px] font-bold">{selection.size}개 선택</span>
        <span className="mx-1 h-5 w-px bg-line" />
        <Stars value={same} size={17} onChange={(r) => act().setRating(ids, r)} />
        <button type="button" title="맨 위에 고정 (P)" aria-label="고정" aria-pressed={pinnedAll} onClick={() => act().togglePin(ids)} className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-raise ${pinnedAll ? 'text-mark' : 'text-mute hover:text-ink'}`}>
          <Pin size={16} />
        </button>
        {imageIds.length >= 2 && (
          <button type="button" title="선택한 이미지 비교 (C) — 2~4장" onClick={() => act().openCompare(imageIds)} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-mute transition hover:bg-raise hover:text-ink">
            <Columns2 size={15} /> 비교
          </button>
        )}
        {sort === 'manual' && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-mute transition hover:bg-raise hover:text-ink">
            <ArrowRightToLine size={15} /> 섹션으로 이동 <ChevronUp size={13} className={open ? '' : 'rotate-180'} />
          </button>
        )}
        <button type="button" title="삭제 (Delete)" aria-label="삭제" onClick={() => act().deleteItems(ids)} disabled={!selection.size} className="flex h-9 w-9 items-center justify-center rounded-full text-[#e5534b] transition hover:bg-raise disabled:opacity-40">
          <Trash2 size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" title="선택 해제 (Esc)" aria-label="선택 해제" onClick={() => act().setSelectMode(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-mute transition hover:bg-raise hover:text-ink">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
