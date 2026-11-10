// 여러 개 선택 · 일괄 처리
// - PC: Ctrl(⌘)+클릭으로 하나씩, Shift+클릭으로 범위, Ctrl+A 로 보이는 것 전부
// - 휴대폰: 길게 눌러 선택 시작 → 이어서 톡톡 눌러 추가
import { useRef, useState } from 'react';
import { Check, FolderInput, Hash, RotateCcw, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { useCompact } from '../hooks/useMedia';
import { useBackClose } from '../hooks/useBackClose';
import { Button, IconButton } from './ui';
import { OkMark } from './Scribble';
import { categoryOptions } from './CategoryPicker';

/** 지금 화면에 보이는 순서 (Shift 범위 선택 · 전체 선택용). 갤러리가 그릴 때마다 갱신 */
export const visibleOrder: { current: string[] } = { current: [] };

export const useSelecting = () => useStore((s) => s.selectMode || s.selected.length > 0);

/** 카드·목록 줄 공통: 클릭/길게 누르기 처리 */
export function useItemPress(id: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const activate = (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
    const st = useStore.getState();
    const selecting = st.selectMode || st.selected.length > 0;
    if (e.shiftKey && st.lastSelected) {
      const order = visibleOrder.current;
      const a = order.indexOf(st.lastSelected);
      const b = order.indexOf(id);
      if (a !== -1 && b !== -1) {
        const range = order.slice(Math.min(a, b), Math.max(a, b) + 1);
        st.setSelected([...new Set([...st.selected, ...range])], id);
        return;
      }
    }
    if (e.ctrlKey || e.metaKey || selecting) {
      st.toggleSelect(id);
      return;
    }
    st.set({ openId: id });
  };

  return {
    onClick(e: React.MouseEvent) {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      activate(e);
    },
    onKeyDown(e: React.KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(e);
      }
    },
    onPointerDown(e: React.PointerEvent) {
      longPressed.current = false;
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        longPressed.current = true;
        useStore.getState().toggleSelect(id);
        navigator.vibrate?.(12);
      }, 430);
    },
    onPointerMove(e: React.PointerEvent) {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 9) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(e: React.MouseEvent) {
      // 휴대폰에서 길게 누를 때 뜨는 '이미지 저장' 메뉴 막기
      if (longPressed.current || timer.current) e.preventDefault();
    },
  };
}

/** 카드 위 선택 표시 */
export function SelectDot({ on, show }: { on: boolean; show: boolean }) {
  if (!on && !show) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-2 top-2 z-[2] grid h-6 w-6 place-items-center rounded-full border-2 transition ${
        on ? 'border-mark bg-mark text-bg' : 'border-white/90 bg-black/25 backdrop-blur-sm'
      }`}
    >
      {on && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

function TagAdder({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { bulkUpdate } = useStore();
  const [v, setV] = useState('');
  const apply = () => {
    const tags = v.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);
    if (tags.length) bulkUpdate(ids, (it) => ({ tags: [...new Set([...it.tags, ...tags])] }), `${ids.length}개에 #${tags.join(' #')} 추가`);
    onDone();
  };
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') apply();
        if (e.key === 'Escape') {
          e.preventDefault();
          onDone();
        }
      }}
      onBlur={() => (v.trim() ? apply() : onDone())}
      placeholder="태그 입력 후 Enter"
      className="h-9 w-40 rounded-lg border border-line bg-bg px-3 text-[14px] outline-none focus:border-ink/60"
    />
  );
}

export function SelectionBar() {
  const { selected, scope, categories, items, clearSelection, setSelected, bulkUpdate, trashItems, restoreItems, purgeItems } = useStore();
  const selecting = useSelecting();
  const compact = useCompact();
  const [tagging, setTagging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  useBackClose(selecting, clearSelection);
  if (!selecting) return null;

  const n = selected.length;
  const inTrash = scope.kind === 'trash';
  const picked = items.filter((i) => selected.includes(i.id));
  const allFav = picked.length > 0 && picked.every((i) => i.favorite);
  const allVisible = visibleOrder.current;
  const everything = allVisible.length > 0 && allVisible.every((id) => selected.includes(id));

  const move = (catId: string) => {
    const target = catId === '__inbox' ? null : catId;
    const name = target ? categories.find((c) => c.id === target)?.name : '미분류';
    bulkUpdate(selected, () => ({ category_id: target }), `${n}개를 ${name}(으)로 옮겼습니다`);
    clearSelection();
  };

  return (
    <div
      className={`fixed z-30 flex items-center gap-1.5 border border-line bg-panel/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md sheet-up ${
        compact
          ? 'safe-bottom inset-x-0 bottom-0 flex-wrap rounded-t-2xl px-3 pt-3'
          : 'bottom-5 left-1/2 -translate-x-1/2 rounded-xl px-2 py-2'
      }`}
      role="toolbar"
      aria-label="선택한 항목 처리"
    >
      <IconButton label="선택 끝내기 (Esc)" onClick={clearSelection}>
        <X size={18} />
      </IconButton>
      <span className="num min-w-[4.5em] px-1 text-[14px] font-bold">{n ? `${n}개 선택` : '골라 주세요'}</span>
      <button
        type="button"
        onClick={() => setSelected(everything ? [] : [...new Set([...selected, ...allVisible])])}
        className="h-9 rounded-lg px-2.5 text-[13px] font-semibold text-mute hover:bg-raise hover:text-ink"
      >
        {everything ? '모두 해제' : '모두 선택'}
      </button>
      <span className={`mx-1 h-6 w-px bg-line ${compact ? 'hidden' : ''}`} />

      {inTrash ? (
        <>
          <Button className="h-9 px-3" disabled={!n} onClick={() => (restoreItems(selected), clearSelection())}>
            <RotateCcw size={15} /> 되돌리기
          </Button>
          <Button
            variant="danger"
            className="h-9 px-3"
            disabled={!n}
            onBlur={() => setConfirmPurge(false)}
            onClick={() => {
              if (!confirmPurge) return setConfirmPurge(true);
              purgeItems(selected);
              clearSelection();
              setConfirmPurge(false);
            }}
          >
            <Trash2 size={15} /> {confirmPurge ? '한 번 더 → 영구 삭제' : '영구 삭제'}
          </Button>
        </>
      ) : (
        <>
          <label className={`relative inline-flex h-9 items-center gap-1.5 rounded-lg bg-raise px-3 text-[14px] font-semibold ${n ? 'cursor-pointer hover:bg-line' : 'opacity-40'}`}>
            <FolderInput size={15} /> 옮기기
            <select
              aria-label="카테고리로 옮기기"
              disabled={!n}
              value=""
              onChange={(e) => e.target.value && move(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">옮길 곳 고르기</option>
              <option value="__inbox">미분류</option>
              {categoryOptions(categories).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {tagging ? (
            <TagAdder ids={selected} onDone={() => setTagging(false)} />
          ) : (
            <Button className="h-9 px-3" disabled={!n} onClick={() => setTagging(true)}>
              <Hash size={15} /> 태그
            </Button>
          )}
          <Button
            className="h-9 px-3"
            disabled={!n}
            onClick={() => bulkUpdate(selected, () => ({ favorite: !allFav }), allFav ? '즐겨찾기를 풀었습니다' : `${n}개를 즐겨찾기했습니다`)}
          >
            <OkMark on={!allFav} size={18} /> {allFav ? '즐겨찾기 풀기' : '즐겨찾기'}
          </Button>
          <Button variant="danger" className="h-9 px-3" disabled={!n} onClick={() => (trashItems(selected), clearSelection())}>
            <Trash2 size={15} /> 휴지통
          </Button>
        </>
      )}
      {compact && <div className="h-3 w-full" />}
    </div>
  );
}
