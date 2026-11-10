// 카테고리 관리: 추가 · 하위 카테고리 · 이름/색/아이콘 · 같은 단계 안에서 순서 끌어 바꾸기 · 다른 카테고리 아래로 옮기기 · 삭제
import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CornerDownRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useCounts } from '../hooks/useVisible';
import type { Category } from '../lib/types';
import { CATEGORY_COLORS } from '../lib/colors';
import { canMoveUnder, childrenMap, flatten } from '../lib/tree';
import { Button, Modal, inputCls } from './ui';

function Row({ c, depth, onAddChild }: { c: Category; depth: number; onAddChild: () => void }) {
  const { updateCategory, deleteCategory, moveCategory, categories } = useStore();
  const counts = useCounts();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, data: { parent: c.parent_id ?? null } });
  const [palette, setPalette] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const count = counts.byCat.get(c.id) || 0;
  const direct = counts.direct.get(c.id) || 0;
  const hasKids = categories.some((x) => x.parent_id === c.id);
  const parentOptions = flatten(categories).filter(({ cat }) => canMoveUnder(categories, c.id, cat.id));

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-lg ${isDragging ? 'relative z-10 bg-raise shadow-xl' : ''}`}>
      <div className="flex items-center gap-1.5 py-1 pr-2" style={{ paddingLeft: 8 + depth * 22 }}>
        {depth > 0 && <CornerDownRight size={13} className="shrink-0 text-faint" />}
        <button type="button" className="grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center text-faint active:cursor-grabbing" aria-label={`${c.name} 순서 바꾸기 (같은 단계 안에서)`} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={() => setPalette((p) => !p)} className="grid h-9 w-8 shrink-0 place-items-center rounded-lg hover:bg-raise" aria-label="색 바꾸기" title="색 바꾸기">
          <span className="block h-4 w-4 rounded-full" style={{ background: c.color }} />
        </button>
        <input
          defaultValue={c.icon}
          maxLength={2}
          placeholder="🎬"
          aria-label="아이콘(이모지)"
          title="아이콘(이모지, 선택)"
          onBlur={(e) => e.target.value !== c.icon && updateCategory(c.id, { icon: e.target.value.trim() })}
          className="h-9 w-9 shrink-0 rounded-lg bg-transparent text-center text-[16px] outline-none placeholder:opacity-30 hover:bg-raise focus:bg-raise"
        />
        <input
          defaultValue={c.name}
          aria-label="카테고리 이름"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== c.name) updateCategory(c.id, { name: v });
            else e.target.value = c.name;
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[15px] font-semibold outline-none hover:bg-raise focus:bg-raise"
        />
        <span className="num w-8 shrink-0 text-right text-[12px] text-faint" title={hasKids ? `이 카테고리 ${direct}개 + 하위 포함 ${count}개` : undefined}>
          {count}
        </span>
        <button type="button" onClick={onAddChild} className="grid h-9 w-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-raise hover:text-ink" aria-label={`${c.name} 안에 하위 카테고리 만들기`} title="하위 카테고리 만들기">
          <Plus size={15} />
        </button>
        <button type="button" onClick={() => setConfirm((x) => !x)} className="grid h-9 w-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-raise hover:text-ink" aria-label={`${c.name} 삭제`}>
          <Trash2 size={15} />
        </button>
      </div>

      {palette && (
        <div className="space-y-2 pb-3" style={{ paddingLeft: 56 + depth * 22 }}>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                aria-label={col}
                onClick={() => updateCategory(c.id, { color: col })}
                className="h-7 w-7 rounded-full"
                style={{ background: col, boxShadow: col === c.color ? '0 0 0 2px var(--panel), 0 0 0 4px var(--mark)' : undefined }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-mute">
            위치
            <select
              value={c.parent_id || ''}
              onChange={(e) => moveCategory(c.id, e.target.value || null)}
              className="h-8 max-w-[16rem] cursor-pointer rounded-lg border border-line bg-bg px-2 text-[13px] text-ink outline-none"
            >
              <option value="">맨 위 (상위 없음)</option>
              {parentOptions.map(({ cat, depth: d }) => (
                <option key={cat.id} value={cat.id}>
                  {`${'   '.repeat(d)}${cat.name} 안으로`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {confirm && (
        <div className="mb-2 mr-2 rounded-lg bg-bg p-3 text-[13px]" style={{ marginLeft: 8 + depth * 22 }}>
          <p className="mb-2.5">
            <b>{c.name}</b> 카테고리를 지웁니다. 바로 안에 있는 항목 {direct}개는 어떻게 할까요?
            {hasKids && <span className="block text-mute">하위 카테고리는 지우지 않고 한 단계 위로 올립니다.</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button className="h-8 px-3 text-[13px]" onClick={() => deleteCategory(c.id, false)}>
              미분류로 옮기고 삭제
            </Button>
            {direct > 0 && (
              <Button variant="danger" className="h-8 px-3 text-[13px]" onClick={() => deleteCategory(c.id, true)}>
                항목까지 모두 삭제
              </Button>
            )}
            <Button variant="ghost" className="h-8 px-3 text-[13px]" onClick={() => setConfirm(false)}>
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Branch({ parent, depth, kids, adding, setAdding }: { parent: string | null; depth: number; kids: Map<string | null, Category[]>; adding: string | null; setAdding: (id: string | null) => void }) {
  const { addCategory, categories } = useStore();
  const list = kids.get(parent) || [];
  const [name, setName] = useState('');
  const submitChild = async (pid: string) => {
    const n = name.trim();
    setAdding(null);
    setName('');
    if (!n) return;
    const p = categories.find((c) => c.id === pid);
    await addCategory(n, p?.color || CATEGORY_COLORS[0], pid);
  };
  return (
    <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
      {list.map((c) => (
        <div key={c.id}>
          <Row c={c} depth={depth} onAddChild={() => setAdding(c.id)} />
          <Branch parent={c.id} depth={depth + 1} kids={kids} adding={adding} setAdding={setAdding} />
          {adding === c.id && (
            <div className="flex gap-2 py-1 pr-2" style={{ paddingLeft: 30 + (depth + 1) * 22 }}>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitChild(c.id);
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setAdding(null);
                  }
                }}
                placeholder={`${c.name} 안에 만들 이름`}
                className={`${inputCls} h-9 py-1`}
              />
              <Button className="h-9" onClick={() => submitChild(c.id)}>
                추가
              </Button>
            </div>
          )}
        </div>
      ))}
    </SortableContext>
  );
}

export function CategoryManager() {
  const { panel, set, categories, reorderCategories, addCategory } = useStore();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const kids = childrenMap(categories);

  // 같은 상위 아래에서만 순서를 바꿉니다 (다른 단계로 옮기기는 색 버튼 → '위치')
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const pa = active.data.current?.parent ?? null;
    const po = over.data.current?.parent ?? null;
    if (pa !== po) return;
    const ids = (kids.get(pa) || []).map((c) => c.id);
    reorderCategories(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  const add = () => {
    if (!name.trim()) return;
    addCategory(name, CATEGORY_COLORS[(kids.get(null) || []).length % CATEGORY_COLORS.length], null);
    setName('');
  };

  return (
    <Modal open={panel === 'categories'} onClose={() => set({ panel: null })} title="카테고리 관리" width={620}>
      <div className="px-2 py-3">
        {categories.length === 0 ? (
          <p className="px-4 py-4 text-mute">아직 카테고리가 없습니다. 아래에서 만들어 보세요. 예: 카메라 무빙, 타이포, 색감, 전환</p>
        ) : (
          <p className="px-4 pb-2 text-[12px] text-faint">+ 로 하위 카테고리를 만들고, 색 버튼에서 위치(상위)를 바꿀 수 있습니다. 순서는 같은 단계 안에서 끌어서 바꿉니다.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <Branch parent={null} depth={0} kids={kids} adding={adding} setAdding={setAdding} />
        </DndContext>
        <div className="mt-2 flex gap-2 px-3 pb-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="새 카테고리 이름 (맨 위)" className={inputCls} data-autofocus />
          <Button variant="primary" onClick={add} disabled={!name.trim()}>
            <Plus size={16} /> 추가
          </Button>
        </div>
      </div>
    </Modal>
  );
}
