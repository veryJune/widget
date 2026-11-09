// 상세 보기: 크게 보기 + 정보 + 영상 구간 북마크
// PC: 왼쪽 미디어, 오른쪽 정보 / 모바일: 전체 화면, 좌우로 밀어서 이전·다음
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clapperboard, Download, ExternalLink, ImageDown, Pencil, Repeat, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { useVisibleItems } from '../hooks/useVisible';
import { useCompact } from '../hooks/useMedia';
import { draftFromItem, titleOf } from '../lib/capture';
import { embedAt, PROVIDER_LABEL } from '../lib/embed';
import type { Item, Marker, MediaFile } from '../lib/types';
import { useUrl } from '../lib/urls';
import { backend } from '../lib/backend';
import { captureFrame } from '../lib/media';
import { domainOf, fmtBytes, fmtDate, fmtTime, parseTime, uid } from '../lib/util';
import { familyOf } from '../lib/colors';
import { primeUrl } from '../lib/urls';
import { Button, IconButton, Swatch, inputCls } from './ui';
import { OkMark } from './Scribble';

// ---------------- 구간 북마크 ----------------

function MarkerList({ item, onPlay, active }: { item: Item; onPlay: (m: Marker) => void; active: string | null }) {
  const updateItem = useStore((s) => s.updateItem);
  const markers = [...item.markers].sort((a, b) => a.start - b.start);
  if (!markers.length) return <p className="text-[13px] text-faint">아직 표시한 구간이 없습니다.</p>;
  return (
    <ul className="space-y-1">
      {markers.map((m) => (
        <li key={m.id} className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${active === m.id ? 'bg-raise' : 'hover:bg-raise/60'}`}>
          <button type="button" onClick={() => onPlay(m)} className="num inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold" title="이 구간 재생">
            <span className="h-3 w-[3px] rounded-full bg-mark" />
            {fmtTime(m.start)}
            {m.end != null && <span className="text-mute">– {fmtTime(m.end)}</span>}
          </button>
          <input
            defaultValue={m.note || ''}
            placeholder="메모"
            onBlur={(e) => {
              const note = e.target.value.trim();
              if (note !== (m.note || '')) updateItem(item.id, { markers: item.markers.map((x) => (x.id === m.id ? { ...x, note } : x)) });
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          <button type="button" aria-label="구간 지우기" onClick={() => updateItem(item.id, { markers: item.markers.filter((x) => x.id !== m.id) })} className="text-faint opacity-60 hover:text-ink group-hover:opacity-100">
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function VideoPlayer({ m, videoRef }: { m: MediaFile; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const url = useUrl(m.path);
  const poster = useUrl(m.thumb);
  // '이 장면을 썸네일로'를 위해 CORS 모드로 열고, 저장소가 허용하지 않으면 일반 모드로 다시 엽니다.
  const [cors, setCors] = useState(true);
  return (
    <video
      ref={videoRef}
      key={`${m.path}-${cors}`}
      src={url}
      poster={poster}
      controls
      playsInline
      crossOrigin={cors ? 'anonymous' : undefined}
      onError={() => cors && setCors(false)}
      className="max-h-full max-w-full bg-black"
    />
  );
}

function VideoMarkers({ item, m, videoRef }: { item: Item; m: MediaFile; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const { updateItem, toast, replaceItem } = useStore();
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [loop, setLoop] = useState<Marker | null>(null);
  const [busy, setBusy] = useState(false);

  // 구간 반복 재생
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !loop || loop.end == null) return;
    const on = () => {
      if (v.currentTime >= loop.end! || v.currentTime < loop.start - 0.5) v.currentTime = loop.start;
    };
    v.addEventListener('timeupdate', on);
    return () => v.removeEventListener('timeupdate', on);
  }, [loop, videoRef]);

  const markIn = () => {
    const t = videoRef.current?.currentTime ?? 0;
    setInPoint(t);
    toast(`IN ${fmtTime(t)}`, { ms: 1200 });
  };
  const markOut = () => {
    const t = videoRef.current?.currentTime ?? 0;
    const start = inPoint != null && inPoint < t ? inPoint : Math.max(0, t - 3);
    updateItem(item.id, { markers: [...item.markers, { id: uid(), start, end: t }] });
    setInPoint(null);
    toast(`구간 ${fmtTime(start)}–${fmtTime(t)} 표시`, { ms: 1500 });
  };

  // 단축키 I / O
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.key === 'i' || e.key === 'I') markIn();
      if (e.key === 'o' || e.key === 'O') markOut();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const play = (mk: Marker) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = mk.start;
    v.play().catch(() => {});
    setLoop(mk.end != null ? mk : null);
  };

  const setPoster = async () => {
    const v = videoRef.current;
    if (!v) return;
    setBusy(true);
    try {
      const { thumb, colors } = await captureFrame(v);
      const s = await backend.session();
      const path = `${s!.userId}/${item.id}/${uid().slice(0, 8)}_t.${thumb.ext}`;
      await backend.upload(path, thumb.blob, thumb.mime);
      primeUrl(path, URL.createObjectURL(thumb.blob));
      const old = m.thumb;
      const media = item.media.map((x) => (x.path === m.path ? { ...x, thumb: path, thumbSize: thumb.blob.size, colors } : x));
      const isFirst = item.media[0]?.path === m.path;
      await replaceItem({ ...item, media, cover: isFirst ? path : item.cover, colors: isFirst ? colors : item.colors });
      if (old) backend.remove([old]);
      toast('이 장면을 썸네일로 바꿨습니다');
    } catch {
      toast('썸네일을 만들지 못했습니다.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between text-[13px] font-semibold text-mute">
        구간 북마크
        {loop && (
          <button type="button" onClick={() => setLoop(null)} className="inline-flex items-center gap-1 text-[12px] text-ink">
            <Repeat size={12} /> 반복 끄기
          </button>
        )}
      </h3>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Button className="h-8 px-3 text-[13px]" onClick={markIn} title="단축키 I">
          IN {inPoint != null && <span className="num text-mute">{fmtTime(inPoint)}</span>}
        </Button>
        <Button className="h-8 px-3 text-[13px]" onClick={markOut} title="단축키 O">
          OUT 구간 저장
        </Button>
        <Button variant="ghost" className="h-8 px-3 text-[13px]" disabled={busy} onClick={setPoster}>
          <ImageDown size={14} /> 이 장면을 썸네일로
        </Button>
      </div>
      <MarkerList item={item} onPlay={play} active={loop?.id ?? null} />
    </section>
  );
}

function EmbedMarkers({ item, onSeek }: { item: Item; onSeek: (sec: number) => void }) {
  const updateItem = useStore((s) => s.updateItem);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const add = () => {
    const s = parseTime(start);
    if (s == null) return;
    const e = parseTime(end);
    updateItem(item.id, { markers: [...item.markers, { id: uid(), start: s, end: e != null && e > s ? e : undefined }] });
    setStart('');
    setEnd('');
  };
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-semibold text-mute">구간 북마크</h3>
      <div className="mb-3 flex items-center gap-1.5">
        <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="시작 1:23" className={`${inputCls} h-9 w-24 py-1 text-[14px]`} />
        <input value={end} onChange={(e) => setEnd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="끝 (선택)" className={`${inputCls} h-9 w-24 py-1 text-[14px]`} />
        <Button className="h-9 px-3 text-[13px]" onClick={add}>
          추가
        </Button>
      </div>
      <MarkerList item={item} onPlay={(m) => onSeek(m.start)} active={null} />
    </section>
  );
}

// ---------------- 미디어 영역 ----------------

function ImageView({ m }: { m: MediaFile }) {
  const thumb = useUrl(m.thumb);
  const full = useUrl(m.path);
  return <img src={full || thumb} alt="" className="max-h-full max-w-full object-contain" />;
}

function FileView({ m }: { m: MediaFile }) {
  const url = useUrl(m.path);
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl bg-panel p-8">
      <p className="text-[17px] font-bold">{m.name}</p>
      <p className="num text-mute">{fmtBytes(m.size)}</p>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" download={m.name} className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-[14px] font-semibold text-bg">
          <Download size={16} /> 열기 · 내려받기
        </a>
      )}
    </div>
  );
}

function EmbedFrame({ item, src }: { item: Item; src: string }) {
  const e = item.embed!;
  const style = e.fixedHeight ? { width: 'min(100%, 560px)', height: e.fixedHeight } : { aspectRatio: String(e.aspect), height: e.aspect < 1 ? 'min(100%, 86dvh)' : undefined, width: e.aspect >= 1 ? 'min(100%, 1100px)' : undefined, maxHeight: '100%', maxWidth: '100%' };
  return (
    <iframe
      key={src}
      src={src}
      title={titleOf(item)}
      style={style}
      className="rounded-lg bg-black"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function LinkView({ item }: { item: Item }) {
  const cover = useUrl(item.cover);
  return (
    <div className="flex max-h-full max-w-3xl flex-col items-start gap-4">
      {cover && <img src={cover} alt="" referrerPolicy="no-referrer" className="max-h-[60dvh] max-w-full rounded-lg object-contain" />}
      <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-[14px] font-semibold text-bg">
        <ExternalLink size={16} /> {item.link?.site || domainOf(item.url)}에서 열기
      </a>
    </div>
  );
}

// ---------------- 상세 보기 ----------------

export function Detail() {
  const { openId, items, categories, set, updateItem, deleteItem } = useStore();
  const list = useVisibleItems();
  const compact = useCompact();
  const item = items.find((i) => i.id === openId);
  const [mi, setMi] = useState(0);
  const [confirmDel, setConfirmDel] = useState(false);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMi(0);
    setConfirmDel(false);
    setEmbedSrc(null);
  }, [openId]);

  const idx = useMemo(() => list.findIndex((i) => i.id === openId), [list, openId]);
  const go = (d: number) => {
    if (idx < 0) return;
    const next = list[idx + d];
    if (next) set({ openId: next.id });
  };

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || useStore.getState().composer.open) return;
      if (e.key === 'Escape') set({ openId: null });
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'f' || e.key === 'F') updateItem(item.id, { favorite: !item.favorite });
      if (e.key === 'e' || e.key === 'E') set({ composer: { open: true, draft: draftFromItem(item) } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 어떤 부분이 화면 위에 열려 있으면 뒤 스크롤 막기
  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [!!item]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const m: MediaFile | undefined = item.media[Math.min(mi, Math.max(0, item.media.length - 1))];

  const cat = categories.find((c) => c.id === item.category_id);
  const title = titleOf(item);

  let stage: React.ReactNode;
  if (m?.kind === 'video') stage = <VideoPlayer m={m} videoRef={videoRef} />;
  else if (m?.kind === 'image') stage = <ImageView key={m.path} m={m} />;
  else if (m?.kind === 'file') stage = <FileView m={m} />;
  else if (item.embed) stage = <EmbedFrame item={item} src={embedSrc || item.embed.embedUrl} />;
  else if (item.type === 'link') stage = <LinkView item={item} />;
  else stage = <p className="note-text max-w-[62ch] text-[19px] leading-[1.75]">{item.body || item.title}</p>;

  const info = (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-start gap-2">
          <h2 className="flex-1 text-[20px] font-extrabold leading-snug tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={() => updateItem(item.id, { favorite: !item.favorite })}
            aria-pressed={item.favorite}
            aria-label="즐겨찾기 (F)"
            title="즐겨찾기 (F)"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-mute hover:bg-raise hover:text-ink"
          >
            {item.favorite ? <OkMark on size={24} /> : <span className="block h-[18px] w-[18px] rounded-full border-2 border-current" />}
          </button>
        </div>
        <select
          aria-label="카테고리"
          value={item.category_id || ''}
          onChange={(e) => updateItem(item.id, { category_id: e.target.value || null })}
          className="h-8 cursor-pointer rounded-full border-0 bg-raise px-3 text-[13px] font-semibold outline-none"
          style={cat ? { boxShadow: `inset 3px 0 0 ${cat.color}` } : undefined}
        >
          <option value="">인박스</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {item.why && <p className="border-l-2 border-mark pl-3 text-[15px] leading-relaxed">{item.why}</p>}
      {item.body && (item.media.length > 0 || item.embed || item.type === 'link') && <p className="note-text text-[14px] leading-relaxed text-ink/85">{item.body}</p>}
      {!item.body && item.link?.description && <p className="text-[14px] leading-relaxed text-mute">{item.link.description}</p>}

      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[14px] font-semibold text-ink underline-offset-4 hover:underline">
          <ExternalLink size={14} className="shrink-0 text-mute" />
          <span className="truncate">{item.embed ? `${PROVIDER_LABEL[item.embed.provider]} · ` : ''}{domainOf(item.url)}</span>
        </a>
      )}

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <button key={t} type="button" onClick={() => set({ tag: t, openId: null })} className="h-7 rounded-full bg-raise px-2.5 text-[13px] font-semibold text-mute hover:text-ink" title={`#${t} 모아 보기`}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {m?.kind === 'video' && <VideoMarkers key={m.path} item={item} m={m} videoRef={videoRef} />}
      {item.embed?.seekable && !m && <EmbedMarkers item={item} onSeek={(sec) => setEmbedSrc(embedAt(item.embed!, sec))} />}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-faint">담은 날</dt>
        <dd className="num">{fmtDate(item.created_at)}</dd>
        {m?.w && m?.h ? (
          <>
            <dt className="text-faint">크기</dt>
            <dd className="num">
              {m.w}×{m.h}
              {m.duration ? ` · ${fmtTime(m.duration)}` : ''} · {fmtBytes(m.size)}
            </dd>
          </>
        ) : null}
        {item.colors.length > 0 && (
          <>
            <dt className="text-faint">색</dt>
            <dd className="flex gap-1.5 pt-0.5">
              {item.colors.map((c) => (
                <button key={c} type="button" title={`${c} 비슷한 색 찾기`} onClick={() => set({ color: familyOf(c), openId: null })}>
                  <Swatch color={c} size={16} />
                </button>
              ))}
            </dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <Button onClick={() => set({ composer: { open: true, draft: draftFromItem(item) } })}>
          <Pencil size={15} /> 수정
        </Button>
        <Button onClick={() => set({ theater: { open: true, startId: item.id } })}>
          <Clapperboard size={15} /> 시어터
        </Button>
        <Button variant="danger" onClick={() => (confirmDel ? deleteItem(item.id) : setConfirmDel(true))} onBlur={() => setConfirmDel(false)}>
          <Trash2 size={15} /> {confirmDel ? '한 번 더 누르면 삭제' : '삭제'}
        </Button>
      </div>
    </div>
  );

  const thumbs =
    item.media.length > 1 ? (
      <div className="no-scrollbar flex justify-center gap-1.5 overflow-x-auto px-4 py-3">
        {item.media.map((x, i) => (
          <MediaThumb key={x.path} m={x} active={i === mi} onClick={() => setMi(i)} />
        ))}
      </div>
    ) : null;

  const nav = (
    <>
      <IconButton label="이전 (←)" disabled={idx <= 0} onClick={() => go(-1)} className="h-10 w-10 bg-panel/80">
        <ChevronLeft size={20} />
      </IconButton>
      <IconButton label="다음 (→)" disabled={idx < 0 || idx >= list.length - 1} onClick={() => go(1)} className="h-10 w-10 bg-panel/80">
        <ChevronRight size={20} />
      </IconButton>
    </>
  );

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || (e.target as HTMLElement).tagName === 'VIDEO') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(t.clientY - s.y) * 1.5) go(dx < 0 ? 1 : -1);
  };

  if (compact) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-bg fade-in" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex h-14 shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
          <IconButton label="닫기" onClick={() => set({ openId: null })} className="h-10 w-10">
            <X size={20} />
          </IconButton>
          <span className="num flex-1 text-center text-[13px] text-faint">{idx >= 0 ? `${idx + 1} / ${list.length}` : ''}</span>
          {nav}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-[46dvh] items-center justify-center bg-black/30 px-2 py-2 [&>img]:max-h-[70dvh] [&>video]:max-h-[70dvh]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {stage}
          </div>
          {thumbs}
          <div className="safe-bottom px-5 py-5">{info}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex bg-bg fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute left-4 top-4 z-10 flex gap-2">{nav}</div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-8 [&>img]:max-h-full [&>video]:max-h-full">{stage}</div>
        {thumbs}
      </div>
      <aside className="scroll-thin flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-line bg-bg">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="num text-[13px] text-faint">{idx >= 0 ? `${idx + 1} / ${list.length}` : ''}</span>
          <IconButton label="닫기 (Esc)" onClick={() => set({ openId: null })}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="px-6 pb-8 pt-2">{info}</div>
      </aside>
    </div>
  );
}

function MediaThumb({ m, active, onClick }: { m: MediaFile; active: boolean; onClick: () => void }) {
  const url = useUrl(m.thumb || (m.kind === 'image' ? m.path : null));
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`h-14 w-14 shrink-0 overflow-hidden rounded-md bg-panel ${active ? 'ring-2 ring-mark' : 'opacity-60 hover:opacity-100'}`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px]">{m.name}</span>}
    </button>
  );
}
