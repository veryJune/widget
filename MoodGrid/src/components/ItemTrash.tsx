// 항목 휴지통: 지운 카드를 다시 살리거나 영구 삭제 (30일 지나면 자동 삭제)
import { useEffect, useMemo } from 'react';
import { Link2, Layers, MessageSquare, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { relTime } from '../lib/util';
import type { Item } from '../types';
import { Button, Modal } from './ui';

function label(i: Item): string {
  if (i.type === 'text') return i.content.slice(0, 60) || '메모';
  if (i.type === 'bookmark') return i.title || i.content;
  if (i.type === 'divider') return `섹션 · ${i.content}`;
  return i.title || i.note.slice(0, 40) || '이미지';
}

export function ItemTrash() {
  const open = useStore((s) => s.trashOpen);
  const items = useStore((s) => s.items);
  const urls = useStore((s) => s.urls);
  const act = useStore.getState;
  const trash = useMemo(() => items.filter((i) => i.deleted_at).sort((a, b) => (b.deleted_at as string).localeCompare(a.deleted_at as string)), [items]);

  useEffect(() => {
    if (open) act().ensureUrls(trash.map((i) => i.thumb));
  }, [open, trash, act]);

  return (
    <Modal
      open={open}
      onClose={() => act().setTrash(false)}
      title={`휴지통 · ${trash.length}`}
      width={560}
      footer={
        trash.length > 0 && (
          <>
            <Button variant="ghost" onClick={() => act().restoreItems(trash.map((i) => i.id))}>
              모두 복구
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (await act().confirm({ title: '휴지통 비우기', body: `${trash.length}개가 완전히 삭제되며 되돌릴 수 없습니다.`, confirm: '모두 영구 삭제', danger: true })) await act().purgeItems(trash.map((i) => i.id));
              }}
            >
              비우기
            </Button>
          </>
        )
      }
    >
      {trash.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-mute">휴지통이 비어 있습니다.</p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-faint">지운 지 30일이 지나면 자동으로 영구 삭제됩니다.</p>
          <ul className="space-y-1.5">
            {trash.map((i) => {
              const src = i.thumb ? urls[i.thumb] : undefined;
              return (
                <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-raise text-faint">
                    {src ? <img src={src} alt="" className="h-full w-full object-cover" draggable={false} /> : i.type === 'bookmark' ? <Link2 size={18} /> : i.type === 'divider' ? <Layers size={18} /> : <MessageSquare size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{label(i)}</p>
                    <p className="text-[12px] text-faint">{relTime(i.deleted_at as string)}에 삭제</p>
                  </div>
                  <button type="button" onClick={() => act().restoreItems([i.id])} className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[13px] font-semibold text-mute hover:bg-raise hover:text-ink">
                    <RotateCcw size={13} /> 복구
                  </button>
                  <button type="button" aria-label="영구 삭제" title="영구 삭제" onClick={() => void act().purgeItems([i.id])} className="flex h-8 w-8 items-center justify-center rounded-md text-mute hover:bg-raise hover:text-[#e5534b]">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
