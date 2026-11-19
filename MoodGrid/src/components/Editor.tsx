// 메모 만들기/고치기 + 카드에 붙이는 메모 편집
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { TEXT_COLORS, type TextColor } from '../types';
import { Button, Modal } from './ui';

const SWATCH: Record<TextColor, string> = { white: 'bg-[#f7f7f7]', yellow: 'bg-[#FFF3B0]', blue: 'bg-[#DCEBFA]', green: 'bg-[#DDEFDF]', dark: 'bg-[#0f0f0f]' };
const SWATCH_NAME: Record<TextColor, string> = { white: '흰색', yellow: '노랑', blue: '파랑', green: '초록', dark: '검정' };

export function Editor() {
  const editor = useStore((s) => s.editor);
  const items = useStore((s) => s.items);
  const act = useStore.getState;
  const target = editor?.id ? items.find((i) => i.id === editor.id) : undefined;
  const [text, setText] = useState('');
  const [color, setColor] = useState<TextColor>('white');

  useEffect(() => {
    if (!editor) return;
    if (editor.mode === 'note') setText(target?.note ?? '');
    else if (editor.mode === 'text') {
      setText(target?.content ?? '');
      setColor(target?.color ?? 'white');
    } else {
      setText('');
      setColor('white');
    }
    // 창을 열 때만 초기화 (글을 칠 때마다 덮어쓰지 않도록 editor 만 의존)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;
  const close = () => act().setEditor(null);
  const title = editor.mode === 'note' ? '메모' : editor.mode === 'text' ? '메모 카드 수정' : '새 메모 카드';
  const save = () => {
    if (editor.mode === 'note' && editor.id) act().setNote(editor.id, text);
    else if (editor.mode === 'text' && editor.id) act().editText(editor.id, text, color);
    else act().addText(text, color);
    close();
  };

  return (
    <Modal
      open
      onClose={close}
      title={title}
      width={460}
      footer={
        <>
          {editor.mode === 'text' && editor.id && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                act().deleteItems([editor.id as string]);
                close();
              }}
            >
              삭제
            </Button>
          )}
          <Button variant="ghost" onClick={close}>
            취소
          </Button>
          <Button variant="primary" onClick={save} disabled={editor.mode !== 'note' && !text.trim()}>
            저장 <span className="text-[12px] opacity-60">Ctrl+Enter</span>
          </Button>
        </>
      }
    >
      <textarea
        data-autofocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (editor.mode === 'note' || text.trim()) save();
          }
        }}
        placeholder={editor.mode === 'note' ? '이 카드에 붙일 메모 (카드 위에 올리면 보여요)' : '아이디어를 기록하세요…'}
        rows={6}
        maxLength={20000}
        className="w-full resize-none rounded-xl border border-line bg-bg p-4 text-[16px] leading-relaxed placeholder:text-faint focus:border-mark focus:outline-none"
      />
      {editor.mode !== 'note' && (
        <div className="mt-4 flex items-center gap-2">
          <span className="mr-1 text-[13px] font-semibold text-mute">색</span>
          {TEXT_COLORS.map((c) => (
            <button key={c} type="button" aria-label={SWATCH_NAME[c]} aria-pressed={color === c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border border-line transition hover:scale-110 ${SWATCH[c]} ${color === c ? 'ring-2 ring-mark ring-offset-2 ring-offset-panel' : ''}`} />
          ))}
        </div>
      )}
    </Modal>
  );
}
