// 작성 창의 카테고리 고르기: 첫 줄은 맨 위 카테고리, 고른 카테고리에 하위가 있으면 둘째 줄에 펼침
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { ancestors, descendants, flatten, siblingsOf } from '../lib/tree';
import { CATEGORY_COLORS } from '../lib/colors';
import { Swatch, inputCls } from './ui';

const chip = (on: boolean, partial = false) =>
  `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition ${
    on ? 'bg-ink text-bg' : partial ? 'bg-raise text-ink ring-1 ring-ink/40' : 'bg-raise text-mute hover:text-ink'
  }`;

function NewInput({ placeholder, onDone: done }: { placeholder: string; onDone: (name: string | null) => void }) {
  const [v, setV] = useState('');
  const finished = useRef(false);
  const onDone = (x: string | null) => {
    if (finished.current) return;
    finished.current = true;
    done(x);
  };
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onDone(v.trim() || null);
        }
        if (e.key === 'Escape') {
          e.preventDefault(); // 작성 창까지 닫히지 않게
          onDone(null);
        }
      }}
      onBlur={() => onDone(v.trim() || null)}
      placeholder={placeholder}
      className={`${inputCls} h-9 w-48 rounded-full py-1`}
    />
  );
}

export function CategoryPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { categories, addCategory } = useStore();
  const [adding, setAdding] = useState<'root' | 'child' | null>(null);
  const roots = siblingsOf(categories, null);
  const path = value ? ancestors(categories, value) : [];
  const root = path[0];
  const inRoot = root ? descendants(categories, root.id) : new Set<string>();
  const sub = root ? flatten(categories).filter((f) => inRoot.has(f.cat.id) && f.cat.id !== root.id) : [];
  const current = path[path.length - 1];

  const create = async (name: string | null, parentId: string | null) => {
    setAdding(null);
    if (!name) return;
    const parent = categories.find((c) => c.id === parentId);
    const color = parent ? parent.color : CATEGORY_COLORS[roots.length % CATEGORY_COLORS.length];
    const c = await addCategory(name, color, parentId);
    onChange(c.id);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
          Inbox
        </button>
        {roots.map((c) => (
          <button key={c.id} type="button" aria-pressed={value === c.id} onClick={() => onChange(c.id)} className={chip(value === c.id, root?.id === c.id && value !== c.id)}>
            {c.icon ? <span>{c.icon}</span> : <Swatch color={c.color} size={8} />} {c.name}
          </button>
        ))}
        {adding === 'root' ? (
          <NewInput placeholder="이름 입력 후 Enter" onDone={(n) => create(n, null)} />
        ) : (
          <button type="button" onClick={() => setAdding('root')} className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-line px-3.5 text-[14px] font-semibold text-faint hover:text-ink">
            <Plus size={14} /> 새 카테고리
          </button>
        )}
      </div>

      {root && (
        <div className="flex flex-wrap items-center gap-1.5 border-l-2 border-line pl-2.5">
          {sub.map(({ cat, depth }) => (
            <button key={cat.id} type="button" aria-pressed={value === cat.id} onClick={() => onChange(cat.id)} className={chip(value === cat.id)}>
              {depth > 1 && <span className="opacity-50">{'›'.repeat(depth - 1)}</span>}
              {cat.icon ? <span>{cat.icon}</span> : null}
              {cat.name}
            </button>
          ))}
          {adding === 'child' ? (
            <NewInput placeholder={`${current?.name ?? ''} 안에 만들기`} onDone={(n) => create(n, current?.id ?? root.id)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding('child')}
              title={`'${current?.name}' 안에 하위 카테고리 만들기`}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] font-semibold text-faint hover:text-ink"
            >
              <Plus size={13} /> {current?.name} 안에 하위
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** 상세 보기 등에서 쓰는 들여쓴 select 목록 */
export function categoryOptions(categories: Parameters<typeof flatten>[0]) {
  return flatten(categories).map(({ cat, depth }) => ({ id: cat.id, label: `${'   '.repeat(depth)}${depth ? '└ ' : ''}${cat.name}` }));
}
