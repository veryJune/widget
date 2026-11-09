// 스마트 컬렉션(모음): 지금 보고 있는 범위·검색·필터를 이름 붙여 저장
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { criteriaFromView, describeCriteria, makeMatcher } from '../lib/filter';
import { Button, Modal, inputCls } from './ui';

export function SaveCollectionDialog() {
  const { panel, set, scope, query, type, aspect, color, tag, collections, categories, items, addCollection } = useStore();
  const open = panel === 'saveCollection';
  const base = scope.kind === 'smart' ? collections.find((c) => c.id === scope.id)?.criteria : undefined;
  const criteria = criteriaFromView(scope, { query, type, aspect, color, tag }, base);
  const suggested = describeCriteria(criteria, categories);
  const [name, setName] = useState(suggested);
  useEffect(() => {
    if (open) setName(suggested);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = makeMatcher(criteria, categories);
  const count = items.reduce((n, i) => n + (m(i) ? 1 : 0), 0);

  const save = async () => {
    set({ panel: null });
    await addCollection(name, criteria);
  };

  return (
    <Modal
      open={open}
      onClose={() => set({ panel: null })}
      title="모음으로 저장"
      width={480}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => set({ panel: null })}>취소</Button>
          <Button variant="primary" onClick={save}>
            저장
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-5">
        <p className="text-[14px] text-mute">
          조건에 맞는 항목이 저절로 모이는 폴더입니다. 새로 담는 항목도 조건에 맞으면 자동으로 들어갑니다. 지금 <b className="text-ink">{count}개</b>가 해당됩니다.
        </p>
        <div className="rounded-lg bg-bg px-3 py-2.5 text-[13px] text-mute">{suggested}</div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-mute">이름</span>
          <input data-autofocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
      </div>
    </Modal>
  );
}
