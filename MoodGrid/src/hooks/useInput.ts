// 붙여넣기 · 끌어다 놓기 · 단축키 (앱 전체에 한 번만 등록)
import { useEffect } from 'react';
import { useStore } from '../store';
import { buildView } from '../lib/order';
import { isUrl, looksLikeImageUrl } from '../lib/util';
import { hover } from '../ui';

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
}

/** 파일 묶음을 나눠서 처리: 영상 파일은 프레임 캡처 화면, 나머지는 이미지로 추가 */
function addFileList(files: File[]) {
  const s = useStore.getState();
  const video = files.find((f) => f.type.startsWith('video/'));
  const rest = files.filter((f) => !f.type.startsWith('video/'));
  if (rest.length) void s.addFiles(rest);
  if (video) {
    if (files.filter((f) => f.type.startsWith('video/')).length > 1) s.toast('영상은 한 번에 하나만 열 수 있어요. 첫 번째 영상을 엽니다.');
    s.setVideoView({ kind: 'file', file: video });
  }
}

function addUrl(url: string) {
  const s = useStore.getState();
  if (looksLikeImageUrl(url)) void s.addImageUrl(url);
  else s.addBookmark(url);
}

/** 글(여러 줄 가능)을 해석: 줄마다 주소면 링크/이미지, 아니면 메모 카드 */
function addFromText(text: string) {
  const s = useStore.getState();
  const t = text.trim();
  if (!t) return;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length && lines.every(isUrl)) {
    lines.slice(0, 30).forEach(addUrl);
    return;
  }
  s.addText(t, 'white');
}

export function useInput() {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useStore.getState();
      if (!s.currentId || s.editor || s.viewerId) return;
      const clip = e.clipboardData;
      if (!clip) return;
      const files = [...(clip.items ?? [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter((f): f is File => !!f);
      if (files.length) {
        e.preventDefault();
        addFileList(files);
        return;
      }
      const text = clip.getData('text');
      if (text) {
        e.preventDefault();
        addFromText(text);
      }
    };

    const hasPayload = (e: DragEvent) => {
      const types = e.dataTransfer?.types ?? [];
      return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain') || types.includes('text/html');
    };
    const onDragOver = (e: DragEvent) => {
      if (hasPayload(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasPayload(e) || isTyping(e.target)) return;
      e.preventDefault();
      const s = useStore.getState();
      if (!s.currentId) return;
      const dt = e.dataTransfer as DataTransfer;
      if (dt.files.length) return addFileList([...dt.files]);
      // 다른 웹페이지에서 끌어온 이미지: html 안의 <img src> 를 우선
      const html = dt.getData('text/html');
      if (html) {
        const src = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src');
        if (src && /^https?:|^data:image\//.test(src)) {
          if (src.startsWith('data:')) void fetch(src).then((r) => r.blob()).then((b) => s.addFiles([new File([b], 'image', { type: b.type })]));
          else void s.addImageUrl(src);
          return;
        }
      }
      const uri = dt.getData('text/uri-list').split(/\r?\n/).find((l) => l && !l.startsWith('#'));
      if (uri && isUrl(uri)) return addUrl(uri);
      addFromText(dt.getData('text/plain'));
    };

    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.viewerId || s.videoView) return; // 크게 보기 · 영상 화면이 자기 키를 처리
      const typing = isTyping(e.target);
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        s.setSwitcher(!s.switcherOpen);
        return;
      }
      if (typing || s.editor || s.ask || s.helpOpen) return;
      const project = s.projects.find((p) => p.id === s.currentId);

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const view = buildView(s.items, { sort: project?.sort_mode ?? 'manual', minRating: s.filter });
        s.select(view.filter((i) => i.type !== 'divider').map((i) => i.id));
        return;
      }
      if (mod || e.altKey) return;

      if (e.key === 'Escape') {
        if (s.switcherOpen) s.setSwitcher(false);
        else if (s.selection.size || s.selectMode) s.setSelectMode(false);
        return;
      }
      const targets = s.selection.size ? [...s.selection] : hover.id ? [hover.id] : [];
      switch (e.key) {
        case '1':
        case '2':
        case '3':
          if (targets.length) s.setRating(targets, Number(e.key) as 1 | 2 | 3);
          break;
        case '0':
          if (targets.length) s.setRating(targets, 0);
          break;
        case 'p':
        case 'P':
          if (targets.length) s.togglePin(targets);
          break;
        case 'Delete':
        case 'Backspace':
          if (targets.length) {
            e.preventDefault();
            s.deleteItems(targets);
          }
          break;
        case ' ': {
          const id = targets[0];
          const it = id ? s.items.find((i) => i.id === id) : null;
          if (it?.type === 'image') {
            e.preventDefault();
            s.setViewer(it.id);
          }
          break;
        }
        case 'n':
        case 'N':
          e.preventDefault();
          s.setEditor({ mode: 'new' });
          break;
        case 's':
        case 'S':
          if (project?.sort_mode === 'manual') s.addDivider();
          break;
        case '[':
          s.setView({ cols: (project?.cols ?? 5) - 1 });
          break;
        case ']':
          s.setView({ cols: (project?.cols ?? 5) + 1 });
          break;
        case '?':
          s.setHelp(true);
          break;
      }
    };

    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}
