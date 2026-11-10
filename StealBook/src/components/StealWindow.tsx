// 크롬 확장 '훔치기'로 열린 작은 창
// 확장이 https://steal-book.vercel.app/?steal=compose&u=…&i=…&t=…&s=… 로 창을 엽니다.
//   steal = compose(작성 창에서 고치고 담기) | quick(바로 담기)
//   u = 페이지/링크 주소, i = 이미지 주소, t = 페이지 제목, s = 선택한 글
// 다 담으면 주소 끝에 #stealbook-done 을 붙이고, 확장이 그걸 보고 창을 닫습니다.
import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { useStore } from '../store';
import { emptyDraft, fetchRemoteImage, titleOf, type Draft } from '../lib/capture';
import { Button } from './ui';
import { Wordmark } from './Scribble';

export interface StealRequest {
  mode: 'compose' | 'quick';
  url: string;
  img: string;
  title: string;
  text: string;
}

export function readSteal(): StealRequest | null {
  const p = new URLSearchParams(location.search);
  const mode = p.get('steal');
  if (mode !== 'compose' && mode !== 'quick') return null;
  const r: StealRequest = { mode, url: p.get('u') || '', img: p.get('i') || '', title: p.get('t') || '', text: p.get('s') || '' };
  history.replaceState(null, '', location.pathname);
  return r;
}

async function fileFromImage(src: string): Promise<File | null> {
  if (src.startsWith('data:')) {
    try {
      const blob = await (await fetch(src)).blob();
      return new File([blob], 'image', { type: blob.type });
    } catch {
      return null;
    }
  }
  if (!/^https?:/.test(src)) return null; // blob: 등은 다른 사이트에서 읽을 수 없음
  return fetchRemoteImage(src);
}

/** 확장이 보낸 내용 → 작성 초안 */
async function draftFromSteal(r: StealRequest): Promise<Draft> {
  const d = emptyDraft(null);
  const pageUrl = /^https?:/.test(r.url) ? r.url : '';
  if (r.img) {
    const f = await fileFromImage(r.img);
    if (f) {
      // 이미지 사본 + 출처는 원래 페이지
      d.files = [f];
      d.url = pageUrl;
      d.title = r.title;
    } else {
      // 사본을 못 받으면 이미지 주소로 미리보기
      d.url = /^https?:/.test(r.img) ? r.img : pageUrl;
      if (pageUrl && d.url !== pageUrl) d.body = `출처: ${pageUrl}`;
      d.title = r.title;
    }
  } else {
    d.url = pageUrl;
    d.title = r.title;
    if (r.text) d.body = r.text.trim();
  }
  return d;
}

/** 창 닫기 신호 (확장이 주소 변화를 보고 닫음, 직접 열었으면 그냥 닫기 시도) */
function finish() {
  location.hash = 'stealbook-done';
  setTimeout(() => window.close(), 80);
}

type Phase = 'prep' | 'compose' | 'saving' | 'dup' | 'done' | 'error';

export function StealWindow({ req }: { req: StealRequest }) {
  const { loaded, composer, pending, items, openComposer, submitDraft, findDuplicate } = useStore();
  const [phase, setPhase] = useState<Phase>('prep');
  const [msg, setMsg] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const draftRef = useRef<Draft | null>(null);
  const started = useRef(false);
  const sawComposer = useRef(false);
  const sawPending = useRef(false);
  const countAtStart = useRef(0);

  const save = async (d: Draft) => {
    setPhase('saving');
    const item = await submitDraft(d, { quiet: true });
    if (item) {
      setSavedTitle(titleOf(item));
      setPhase('done');
    } else {
      setMsg('담지 못했습니다. 인터넷 연결이나 로그인을 확인해 주세요.');
      setPhase('error');
    }
  };

  // 1) 초안 만들기 (항목 목록을 받은 뒤 — 중복 확인용)
  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    (async () => {
      const d = await draftFromSteal(req);
      draftRef.current = d;
      if (req.mode === 'compose') {
        countAtStart.current = useStore.getState().items.length;
        openComposer(d);
        setPhase('compose');
        return;
      }
      const dup = !d.files.length && d.url ? findDuplicate(d.url) : undefined;
      if (dup) {
        setMsg(titleOf(dup));
        setPhase('dup');
        return;
      }
      save(d);
    })();
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) 작성 창이 닫히면: 올리는 중이면 기다렸다가 끝
  useEffect(() => {
    if (phase !== 'compose' && phase !== 'saving') return;
    if (composer.open) {
      sawComposer.current = true;
      return;
    }
    if (!sawComposer.current) return;
    if (pending.length) {
      sawPending.current = true;
      setPhase('saving');
      return;
    }
    if (!sawPending.current) {
      finish(); // 작성 창에서 취소 → 그냥 닫기
      return;
    }
    if (items.length > countAtStart.current) {
      const newest = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (newest) setSavedTitle(titleOf(newest));
      setPhase('done');
    } else {
      setMsg('담지 못했습니다. 인터넷 연결이나 로그인을 확인해 주세요.');
      setPhase('error');
    }
  }, [composer.open, pending.length, phase, items]);

  useEffect(() => {
    if (phase === 'done') {
      const t = setTimeout(finish, 900);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'compose') return null;

  const progress = pending[0]?.label;
  return (
    <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center gap-6 bg-bg px-8 text-center fade-in">
      <Wordmark size={22} />
      {phase === 'prep' && (
        <p className="flex items-center gap-2 text-[15px] text-mute">
          <Loader2 size={16} className="animate-spin" /> {req.img ? '이미지를 가져오는 중…' : '준비하는 중…'}
        </p>
      )}
      {phase === 'saving' && (
        <p className="flex items-center gap-2 text-[15px] text-mute">
          <Loader2 size={16} className="animate-spin" /> {progress || '담는 중…'}
        </p>
      )}
      {phase === 'done' && (
        <div className="space-y-2">
          <p className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mark text-on-mark">
            <Check size={24} strokeWidth={3} />
          </p>
          <p className="text-[17px] font-bold">담았습니다</p>
          {savedTitle && <p className="max-w-[300px] truncate text-[13px] text-faint">{savedTitle}</p>}
        </div>
      )}
      {phase === 'dup' && (
        <div className="space-y-4">
          <p className="text-[16px] font-bold">이미 담아 둔 링크입니다</p>
          <p className="max-w-[300px] truncate text-[13px] text-faint">{msg}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={finish}>닫기</Button>
            <Button variant="primary" onClick={() => draftRef.current && save(draftRef.current)}>
              그래도 담기
            </Button>
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div className="space-y-4">
          <p className="flex items-center justify-center gap-2 text-[15px] font-semibold">
            <TriangleAlert size={16} className="text-mark" /> {msg}
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={finish}>닫기</Button>
            <Button variant="primary" onClick={() => draftRef.current && save(draftRef.current)}>
              다시 시도
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
