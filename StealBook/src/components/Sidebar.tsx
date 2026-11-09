// PC 왼쪽 사이드바: 범위(전체·인박스·즐겨찾기·카테고리), 담기 버튼, 설정
// 카드를 끌어다 카테고리에 놓으면 그 카테고리로 옮겨집니다.
import { useState, type ReactNode } from 'react';
import { Inbox, Layers, Plus, Settings, SlidersHorizontal, Cloud, HardDrive } from 'lucide-react';
import { useStore } from '../store';
import { useCounts } from '../hooks/useVisible';
import type { Scope } from '../lib/types';
import { CATEGORY_COLORS } from '../lib/colors';
import { backend } from '../lib/backend';
import { Button, Swatch, inputCls } from './ui';
import { Wordmark } from './Scribble';

const DRAG_MIME = 'application/x-stealbook-item';

function sameScope(a: Scope, b: Scope) {
  return a.kind === b.kind && (a.kind !== 'cat' || (b.kind === 'cat' && a.id === b.id));
}

function NavRow({ scope, icon, label, count, onDropItem }: { scope: Scope; icon: ReactNode; label: string; count: number; onDropItem?: (id: string) => void }) {
  const { scope: cur, set } = useStore();
  const [over, setOver] = useState(false);
  const active = sameScope(cur, scope);
  return (
    <button
      type="button"
      onClick={() => set({ scope, openId: null })}
      aria-current={active ? 'page' : undefined}
      onDragOver={(e) => {
        if (onDropItem && e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_MIME);
        if (id && onDropItem) {
          e.preventDefault();
          onDropItem(id);
        }
      }}
      className={`group flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[14px] transition ${
        over ? 'bg-mark text-on-mark' : active ? 'bg-raise font-bold text-ink' : 'text-mute hover:bg-panel hover:text-ink'
      }`}
    >
      <span className="grid w-4 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`num text-[12px] ${over ? '' : 'text-faint'}`}>{count || ''}</span>
    </button>
  );
}

export function Sidebar() {
  const { categories, openComposer, updateItem, addCategory, set, toast } = useStore();
  const counts = useCounts();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const move = (category_id: string | null, label: string) => (id: string) => {
    updateItem(id, { category_id });
    toast(category_id ? `'${label}' 카테고리로 옮겼습니다` : '인박스로 옮겼습니다');
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return setAdding(false);
    const c = await addCategory(n, CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]);
    setName('');
    setAdding(false);
    set({ scope: { kind: 'cat', id: c.id } });
  };

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-bg">
      <div className="px-5 pb-5 pt-6">
        <Wordmark size={22} />
      </div>
      <div className="px-3">
        <Button variant="primary" className="w-full justify-between" onClick={() => openComposer()}>
          <span className="inline-flex items-center gap-2">
            <Plus size={16} strokeWidth={2.5} /> 담기
          </span>
          <kbd className="rounded bg-bg/15 px-1.5 text-[11px] font-semibold opacity-70">N</kbd>
        </Button>
      </div>

      <nav className="scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="범위">
        <NavRow scope={{ kind: 'all' }} icon={<Layers size={15} />} label="전체" count={counts.all} />
        <NavRow scope={{ kind: 'inbox' }} icon={<Inbox size={15} />} label="인박스" count={counts.inbox} onDropItem={move(null, '인박스')} />
        <NavRow
          scope={{ kind: 'fav' }}
          icon={<span className="block h-3 w-3 rounded-full border-[1.5px] border-current" />}
          label="즐겨찾기"
          count={counts.fav}
          onDropItem={(id) => updateItem(id, { favorite: true })}
        />

        <div className="mb-1 mt-6 flex items-center justify-between px-3">
          <span className="text-[12px] font-semibold text-faint">카테고리</span>
          <button type="button" onClick={() => set({ panel: 'categories' })} className="rounded p-1 text-faint hover:text-ink" title="카테고리 관리" aria-label="카테고리 관리">
            <SlidersHorizontal size={13} />
          </button>
        </div>
        {categories.map((c) => (
          <NavRow
            key={c.id}
            scope={{ kind: 'cat', id: c.id }}
            icon={c.icon ? <span className="text-[13px] leading-none">{c.icon}</span> : <Swatch color={c.color} size={9} />}
            label={c.name}
            count={counts.byCat.get(c.id) || 0}
            onDropItem={move(c.id, c.name)}
          />
        ))}
        {adding ? (
          <div className="px-1 pt-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') {
                  setName('');
                  setAdding(false);
                }
              }}
              onBlur={submit}
              placeholder="카테고리 이름"
              className={`${inputCls} h-9 py-1.5 text-[14px]`}
            />
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[14px] text-faint transition hover:bg-panel hover:text-ink">
            <Plus size={15} /> 카테고리 추가
          </button>
        )}
      </nav>

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <span className="inline-flex flex-1 items-center gap-2 text-[12px] text-faint" title={backend.mode === 'cloud' ? '여러 기기와 동기화됩니다' : '이 브라우저에만 저장됩니다'}>
          {backend.mode === 'cloud' ? <Cloud size={14} /> : <HardDrive size={14} />}
          {backend.mode === 'cloud' ? '동기화 켜짐' : '체험 모드'}
        </span>
        <button type="button" onClick={() => set({ panel: 'settings' })} className="rounded-lg p-2 text-mute hover:bg-panel hover:text-ink" aria-label="설정" title="설정">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
