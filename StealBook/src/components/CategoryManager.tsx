// 카테고리 관리: 추가 · 이름/색/아이콘 바꾸기 · 순서 끌어 바꾸기 · 삭제
import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useCounts } from '../hooks/useVisible';
import type { Category } from '../lib/types';
import { CATEGORY_COLORS } from '../lib/colors';
import { Button, Modal, inputCls } from './ui';

function Row({ c, count }: { c: Category; count: number }) {
  const { updateCategory, deleteCategory } = useStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [palette, setPalette] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-lg ${isDragging ? 'relative z-10 bg-raise shadow-xl' : ''}`}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button type="button" className="grid h-9 w-7 cursor-grab touch-none place-items-center text-faint active:cursor-grabbing" aria-label={`${c.name} 순서 바꾸기`} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={() => setPalette((p) => !p)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-raise" aria-label="색 바꾸기" title="색 바꾸기">
          <span className="block h-4 w-4 rounded-full" style={{ background: c.color }} />
        </button>
        <input
          defaultValue={c.icon}
          maxLength={2}
          placeholder="🎬"
          aria-label="아이콘(이모지)"
          title="아이콘(이모지, 선택)"
          onBlur={(e) => e.target.value !== c.icon && updateCategory(c.id, { icon: e.target.value.trim() })}
          className="h-9 w-10 rounded-lg bg-transparent text-center text-[16px] outline-none placeholder:opacity-30 hover:bg-raise focus:bg-raise"
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
        <span className="num w-8 text-right text-[12px] text-faint">{count}</span>
        <button type="button" onClick={() => setConfirm((x) => !x)} className="grid h-9 w-9 place-items-center rounded-lg text-faint hover:bg-raise hover:text-ink" aria-label={`${c.name} 삭제`}>
          <Trash2 size={15} />
        </button>
      </div>
      {palette && (
        <div className="flex flex-wrap gap-1.5 px-[52px] pb-2">
          {CATEGORY_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              aria-label={col}
              onClick={() => {
                updateCategory(c.id, { color: col });
                setPalette(false);
              }}
              className="h-7 w-7 rounded-full"
              style={{ background: col, boxShadow: col === c.color ? '0 0 0 2px var(--panel), 0 0 0 4px var(--mark)' : undefined }}
            />
          ))}
        </div>
      )}
      {confirm && (
        <div className="mx-2 mb-2 rounded-lg bg-bg p-3 text-[13px]">
          <p className="mb-2.5">
            <b>{c.name}</b> 카테고리를 지웁니다. 안에 있는 항목 {count}개는 어떻게 할까요?
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button className="h-8 px-3 text-[13px]" onClick={() => deleteCategory(c.id, false)}>
              인박스로 옮기고 삭제
            </Button>
            {count > 0 && (
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
    </li>
  );
}

export function CategoryManager() {
  const { panel, set, categories, reorderCategories, addCategory } = useStore();
  const counts = useCounts();
  const [name, setName] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = categories.map((c) => c.id);
    reorderCategories(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  const add = () => {
    if (!name.trim()) return;
    addCategory(name, CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]);
    setName('');
  };

  return (
    <Modal open={panel === 'categories'} onClose={() => set({ panel: null })} title="카테고리 관리" width={560}>
      <div className="px-3 py-3">
        {categories.length === 0 && <p className="px-3 py-4 text-mute">아직 카테고리가 없습니다. 아래에서 만들어 보세요. 예: 카메라 무빙, 타이포, 색감, 전환</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul>
              {categories.map((c) => (
                <Row key={c.id} c={c} count={counts.byCat.get(c.id) || 0} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="mt-2 flex gap-2 px-2 pb-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="새 카테고리 이름" className={inputCls} data-autofocus />
          <Button variant="primary" onClick={add} disabled={!name.trim()}>
            <Plus size={16} /> 추가
          </Button>
        </div>
      </div>
    </Modal>
  );
}
