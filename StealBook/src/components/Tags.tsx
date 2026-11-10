// 태그 모아 보기 · 거르기 · 정리
// - 사이드바(PC): 많이 쓴 태그 목록. 클릭 = 그 태그만, Ctrl(⌘)+클릭 = 태그 더하기(모두 가진 것만)
//   카드를 태그 위로 끌어다 놓으면 그 태그가 붙습니다.
// - 필터 시트(휴대폰): 태그 칩을 톡톡 눌러 더하기·빼기
// - 태그 정리 창: 이름 바꾸기(같은 이름이면 합치기) · 빼기
import { useMemo, useState } from 'react';
import { ChevronRight, Hash, Pencil, Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../store';
import { useTagCounts } from '../hooks/useVisible';
import { readLS, writeLS } from '../lib/util';
import { Modal, inputCls } from './ui';

const DRAG_MIME = 'application/x-stealbook-item';
const FOLD_KEY = 'stealbook.tagsFolded.v1';
const SHOW = 12;

/** 끌어 온 카드(선택돼 있으면 선택된 것 모두)에 태그 붙이기 */
function dropTag(id: string, tag: string) {
  const st = useStore.getState();
  const ids = st.selected.includes(id) ? st.selected : [id];
  st.bulkUpdate(ids, (it) => ({ tags: [...new Set([...it.tags, tag])] }), `${ids.length > 1 ? `${ids.length}개에 ` : ''}#${tag} 태그를 붙였습니다`);
}

function RenameInput({ tag, onDone, className = '' }: { tag: string; onDone: () => void; className?: string }) {
  const renameTag = useStore((s) => s.renameTag);
  const all = useTagCounts();
  const [v, setV] = useState(tag);
  const clean = v.replace(/^#+/, '').trim().replace(/[\s,]+/g, '_');
  const merging = clean !== tag && all.some(([t]) => t === clean);
  const commit = () => {
    if (clean && clean !== tag) renameTag(tag, clean);
    onDone();
  };
  return (
    <div className={className}>
      <input
        autoFocus
        value={v}
        aria-label={`#${tag} 새 이름`}
        onChange={(e) => setV(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            e.preventDefault();
            onDone();
          }
        }}
        onBlur={commit}
        className={`${inputCls} h-8 text-[13px]`}
      />
      {merging && <p className="mt-1 px-1 text-[11px] font-semibold text-mark">#{clean} 태그와 합쳐집니다</p>}
    </div>
  );
}

function TagRow({ tag, count, compact = false }: { tag: string; count: number; compact?: boolean }) {
  const { tags: picked, pickTag, deleteTag } = useStore();
  const [over, setOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const on = picked.includes(tag);
  if (editing) return <RenameInput tag={tag} onDone={() => setEditing(false)} className="py-0.5 pl-2 pr-1" />;
  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_MIME);
        if (id) {
          e.preventDefault();
          dropTag(id, tag);
        }
      }}
      className={`group flex items-center rounded-lg transition ${compact ? 'h-8' : 'h-9'} ${
        over ? 'bg-mark text-on-mark' : on ? 'bg-raise text-ink' : 'text-mute hover:bg-panel hover:text-ink'
      }`}
    >
      <button
        type="button"
        aria-pressed={on}
        title="클릭: 이 태그만 · Ctrl(⌘)+클릭: 태그 더하기"
        onClick={(e) => pickTag(tag, e.ctrlKey || e.metaKey || e.shiftKey ? 'toggle' : 'only')}
        className={`flex h-full min-w-0 flex-1 items-center gap-1 pl-3 pr-1 text-left text-[13.5px] ${on ? 'font-bold' : ''}`}
      >
        <span className={on ? 'text-mark' : 'text-faint'}>#</span>
        <span className="min-w-0 flex-1 truncate">{tag}</span>
      </button>
      <span className="flex shrink-0 items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" onClick={() => setEditing(true)} aria-label={`#${tag} 이름 바꾸기`} title="이름 바꾸기 · 합치기" className="grid h-7 w-6 place-items-center rounded text-faint hover:text-ink">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={() => deleteTag(tag)} aria-label={`#${tag} 태그 빼기`} title="모든 항목에서 이 태그 빼기" className="grid h-7 w-6 place-items-center rounded text-faint hover:text-ink">
          <X size={13} />
        </button>
      </span>
      <span className={`num w-8 shrink-0 pr-3 text-right text-[12px] ${over ? '' : 'text-faint'}`}>{count}</span>
    </div>
  );
}

/** PC 사이드바의 태그 묶음 */
export function TagSection() {
  const counts = useTagCounts();
  const { tags: picked, set } = useStore();
  const [folded, setFolded] = useState(() => readLS<boolean>(FOLD_KEY, false));
  const [all, setAll] = useState(false);
  const list = useMemo(() => {
    if (all) return counts;
    const top = counts.slice(0, SHOW);
    // 고른 태그는 순위 밖이어도 보이게
    const extra = counts.slice(SHOW).filter(([t]) => picked.includes(t));
    return [...top, ...extra];
  }, [counts, all, picked]);
  const fold = () => {
    setFolded(!folded);
    writeLS(FOLD_KEY, !folded);
  };

  return (
    <section aria-label="태그">
      <div className="mb-1 mt-6 flex items-center justify-between px-3">
        <button type="button" onClick={fold} className="inline-flex items-center gap-1 text-[12px] font-semibold text-faint hover:text-ink" aria-expanded={!folded}>
          <ChevronRight size={12} className={`transition-transform ${folded ? '' : 'rotate-90'}`} /> 태그
          {counts.length > 0 && <span className="num font-normal">{counts.length}</span>}
        </button>
        {counts.length > 0 && (
          <button type="button" onClick={() => set({ panel: 'tags' })} className="rounded p-1 text-faint hover:text-ink" title="태그 정리" aria-label="태그 정리">
            <SlidersHorizontal size={13} />
          </button>
        )}
      </div>
      {!folded &&
        (counts.length === 0 ? (
          <p className="px-3 py-1 text-[12px] leading-relaxed text-faint">항목에 태그를 붙이면 여기 모입니다. 카드를 끌어다 놓아 붙일 수도 있어요.</p>
        ) : (
          <>
            {list.map(([t, n]) => (
              <TagRow key={t} tag={t} count={n} compact />
            ))}
            {counts.length > SHOW && (
              <button type="button" onClick={() => setAll(!all)} className="h-8 w-full rounded-lg px-3 text-left text-[12.5px] font-semibold text-faint hover:bg-panel hover:text-ink">
                {all ? '접기' : `더 보기 (${counts.length - SHOW})`}
              </button>
            )}
            {picked.length > 0 && (
              <p className="px-3 pt-1 text-[11.5px] leading-snug text-faint">
                {picked.length > 1 ? '고른 태그를 모두 가진 항목만 보입니다.' : 'Ctrl(⌘)+클릭으로 태그를 더 고를 수 있어요.'}
              </p>
            )}
          </>
        ))}
    </section>
  );
}

/** 필터 시트(휴대폰)용 태그 칩 */
export function TagChips({ limit = 18 }: { limit?: number }) {
  const counts = useTagCounts();
  const { tags: picked, pickTag, set } = useStore();
  const [all, setAll] = useState(false);
  if (!counts.length) return <p className="text-[13px] text-faint">아직 태그가 없습니다. 항목 상세에서 붙일 수 있어요.</p>;
  const shown = all ? counts : [...counts.slice(0, limit), ...counts.slice(limit).filter(([t]) => picked.includes(t))];
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(([t, n]) => {
        const on = picked.includes(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on}
            onClick={() => pickTag(t, 'toggle')}
            className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition ${on ? 'bg-mark text-on-mark' : 'bg-raise text-mute'}`}
          >
            #{t} <span className={`num text-[11px] font-normal ${on ? '' : 'text-faint'}`}>{n}</span>
          </button>
        );
      })}
      {counts.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="h-8 rounded-full px-3 text-[13px] font-semibold text-faint underline-offset-4 hover:underline">
          {all ? '접기' : `+${counts.length - limit}개 더`}
        </button>
      )}
      <button type="button" onClick={() => set({ panel: 'tags' })} className="h-8 rounded-full px-3 text-[13px] font-semibold text-faint underline-offset-4 hover:underline">
        태그 정리
      </button>
    </div>
  );
}

/** 태그 정리 창: 이름 바꾸기 · 합치기 · 빼기 */
export function TagManager() {
  const { panel, set } = useStore();
  const counts = useTagCounts();
  const [q, setQ] = useState('');
  const [byName, setByName] = useState(false);
  const list = useMemo(() => {
    const f = q.trim().replace(/^#/, '').toLowerCase();
    const l = f ? counts.filter(([t]) => t.toLowerCase().includes(f)) : counts;
    return byName ? [...l].sort((a, b) => a[0].localeCompare(b[0], 'ko')) : l;
  }, [counts, q, byName]);

  return (
    <Modal open={panel === 'tags'} onClose={() => set({ panel: null })} title="태그 정리" width={480}>
      <div className="space-y-3 px-5 py-4">
        <p className="text-[13px] leading-relaxed text-mute">
          연필을 눌러 이름을 바꿉니다. <b className="text-ink">이미 있는 태그 이름으로 바꾸면 두 태그가 합쳐집니다.</b> × 는 모든 항목에서 그 태그를 뺍니다(바로 되돌리기 가능).
        </p>
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="태그 찾기" aria-label="태그 찾기" className={`${inputCls} pl-8`} />
          </label>
          <button
            type="button"
            onClick={() => setByName(!byName)}
            className="h-10 shrink-0 rounded-lg bg-raise px-3 text-[13px] font-semibold text-mute hover:text-ink"
            title="정렬 바꾸기"
          >
            {byName ? '가나다순' : '많이 쓴 순'}
          </button>
        </div>
        <div className="max-h-[52dvh] overflow-y-auto">
          {list.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-[13px] text-faint">
              <Hash size={14} /> {counts.length ? '맞는 태그가 없습니다.' : '아직 태그가 없습니다.'}
            </p>
          ) : (
            list.map(([t, n]) => <ManagerRow key={t} tag={t} count={n} />)
          )}
        </div>
      </div>
    </Modal>
  );
}

function ManagerRow({ tag, count }: { tag: string; count: number }) {
  const { tags: picked, pickTag, deleteTag, set } = useStore();
  const [editing, setEditing] = useState(false);
  if (editing) return <RenameInput tag={tag} onDone={() => setEditing(false)} className="py-1" />;
  return (
    <div className="flex h-11 items-center gap-1 border-b border-line/60">
      <button
        type="button"
        onClick={() => {
          if (!picked.includes(tag)) pickTag(tag, 'toggle');
          set({ panel: null });
        }}
        className="flex min-w-0 flex-1 items-center gap-1 text-left text-[14px] font-semibold"
        title="이 태그로 모아 보기"
      >
        <span className="text-faint">#</span>
        <span className="truncate">{tag}</span>
        <span className="num ml-1.5 text-[12px] font-normal text-faint">{count}</span>
      </button>
      <button type="button" onClick={() => setEditing(true)} aria-label={`#${tag} 이름 바꾸기`} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-raise hover:text-ink">
        <Pencil size={14} />
      </button>
      <button type="button" onClick={() => deleteTag(tag)} aria-label={`#${tag} 태그 빼기`} className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-raise hover:text-ink">
        <X size={15} />
      </button>
    </div>
  );
}
