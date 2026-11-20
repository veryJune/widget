// 영상 보기
//  - YouTube / Vimeo 링크: 안에서 재생 + 시작 시간 지정
//  - 영상 파일(내 컴퓨터) / 영상 파일 주소: 재생하며 원하는 장면을 타임코드와 함께 이미지 카드로 캡처
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronsLeft, ChevronsRight, ExternalLink, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { useStore } from '../store';
import { domainOf, safeHttpUrl } from '../lib/util';
import { embedBadge, embedLabel } from '../lib/providers';
import { PROVIDER_LABEL, embedSrc, fmtStart, fmtTimecode, parseTimeInput, parseVideo, previewTime } from '../lib/video';
import { Button, IconButton, Kbd } from './ui';

export function VideoModal() {
  const v = useStore((s) => s.videoView);
  if (!v) return null;
  return <Inner key={v.kind === 'item' ? v.id : `${v.file.name}:${v.file.size}`} />;
}

function Inner() {
  const view = useStore((s) => s.videoView) as NonNullable<ReturnType<typeof useStore.getState>['videoView']>;
  const items = useStore((s) => s.items);
  const act = useStore.getState;
  const item = view.kind === 'item' ? items.find((i) => i.id === view.id) : undefined;
  const ref = item ? parseVideo(item.content) : null;
  const close = () => act().setVideoView(null);

  // 내 컴퓨터의 파일은 브라우저 안에서만 재생 (업로드하지 않음)
  const fileUrl = useMemo(() => (view.kind === 'file' ? URL.createObjectURL(view.file) : null), [view]);
  useEffect(() => () => void (fileUrl && URL.revokeObjectURL(fileUrl)), [fileUrl]);

  // 항목이 사라지면(삭제 등) 닫기
  useEffect(() => {
    if (view.kind === 'item' && (!item || item.deleted_at || (!ref && !item.embed))) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, ref?.kind]);

  const generic = item && !ref && item.embed ? item : null;
  // Esc 로 닫기 — 모든 종류의 재생 화면에서 (영상 파일 화면은 자체 키 처리도 있음). 입력칸에서는 입력만 빠져나옴
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') {
        t.blur();
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      act().setVideoView(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [act]);

  const playable = view.kind === 'file' ? fileUrl : ref?.kind === 'file' ? ref.url : null;
  const embed = ref ? embedSrc(ref) : null;
  const title = view.kind === 'file' ? view.file.name : item?.title || (ref ? domainOf(ref.url) : generic ? embedLabel(generic.embed) : '영상');
  const original = ref ? safeHttpUrl(ref.url) : generic ? safeHttpUrl(generic.content) : null;

  return (
    <div data-theme="dark" className="fade-in fixed inset-0 z-[70] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label="영상 보기">
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</span>
        {ref && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] text-white/70">{PROVIDER_LABEL[ref.kind]}</span>}
        {generic && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] text-white/70">{embedBadge(generic.embed)}</span>}
        {original && (
          <IconButton label="원본 링크 열기" onClick={() => window.open(original, '_blank', 'noopener,noreferrer')} className="!text-white/80 hover:!bg-white/15">
            <ExternalLink size={18} />
          </IconButton>
        )}
        <IconButton label="닫기 (Esc)" onClick={close} className="!text-white/80 hover:!bg-white/15">
          <X size={20} />
        </IconButton>
      </div>

      {generic && <GenericEmbed key={generic.embed} src={generic.embed as string} title={title} w={generic.w} h={generic.h} />}
      {embed && ref && item ? <Embed key={ref.start} src={embed} title={title} start={ref.start} onStart={(sec) => act().setVideoStart(item.id, sec)} /> : null}
      {playable && <Capture key={playable} src={playable} name={title} crossOrigin={view.kind === 'item'} sourceUrl={view.kind === 'item' ? ref?.url : undefined} initialStart={ref?.start ?? 0} onClose={close} />}
    </div>
  );
}

// ---------- YouTube / Vimeo ----------
function Embed({ src, title, start, onStart }: { src: string; title: string; start: number; onStart: (sec: number) => void }) {
  const [text, setText] = useState(start ? fmtStart(start) : '');
  const parsed = parseTimeInput(text);
  const invalid = text.trim() !== '' && parsed === null;
  const preview = text.trim() && !invalid ? previewTime(text) : null;
  const changed = (parsed ?? 0) !== start;
  const apply = () => {
    if (invalid) return;
    onStart(parsed ?? 0);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4 pb-6">
      <div className="aspect-video w-[min(1100px,92vw,calc((100vh-220px)*16/9))] overflow-hidden rounded-xl bg-black shadow-2xl">
        <iframe src={src} title={title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <form
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[14px]"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label className="flex items-center gap-2 text-white/70">
          시작 시간
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => parsed !== null && text.trim() && setText(fmtStart(parsed))}
            inputMode="numeric"
            placeholder="936 → 9:36"
            aria-invalid={invalid}
            aria-describedby="start-hint"
            className={`h-9 w-32 rounded-lg border bg-white/5 px-3 text-white placeholder:text-white/30 focus:outline-none ${invalid ? 'border-[#e5534b]' : 'border-white/20 focus:border-white/60'}`}
          />
        </label>
        <span id="start-hint" className={`num min-w-[110px] text-[13px] ${invalid ? 'text-[#e5534b]' : 'text-white/60'}`} aria-live="polite">
          {invalid ? '시간을 알 수 없어요' : preview ? `→ ${preview}` : ''}
        </span>
        <Button type="submit" variant="quiet" disabled={invalid || !changed} className="!h-9 !bg-white/10 !text-white hover:!bg-white/20">
          적용
        </Button>
      </form>
      <p className="max-w-[640px] text-center text-[12px] leading-relaxed text-white/40">
        숫자만 쳐도 돼요 (<b className="text-white/60">936</b> · <b className="text-white/60">9 36</b> → 9:36, <b className="text-white/60">10236</b> → 1:02:36). 카드에도 저장됩니다.
        <br />
        YouTube/Vimeo 는 브라우저 보안상 프레임 캡처가 안 돼요 — 화면 캡처(<kbd className="rounded border border-white/20 px-1">Win+Shift+S</kbd> · <kbd className="rounded border border-white/20 px-1">⌘⇧4</kbd>)를 찍고 <kbd className="rounded border border-white/20 px-1">Ctrl+V</kbd> 로 붙여넣으면 보드에 담겨요.
      </p>
    </div>
  );
}

// ---------- 그 밖의 사이트의 임베드 플레이어 (붙여넣은 임베드 코드 · 사이트가 알려 준 플레이어) ----------
// 모르는 사이트의 화면이므로 sandbox 로 가둠: 스크립트는 돌지만 이 앱의 화면을 이동시키거나 정보를 읽을 수 없음
function GenericEmbed({ src, title, w, h }: { src: string; title: string; w: number | null; h: number | null }) {
  const ratio = w && h ? Math.min(4, Math.max(0.4, w / h)) : 16 / 9;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4 pb-6">
      <div className="overflow-hidden rounded-xl bg-black shadow-2xl" style={{ aspectRatio: String(ratio), width: `min(1100px, 92vw, calc((100vh - 200px) * ${ratio}))` }}>
        <iframe
          src={src}
          title={title}
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="max-w-[640px] text-center text-[12px] leading-relaxed text-white/40">
        임베드 플레이어예요. 재생이 안 되면 그 사이트가 다른 사이트 안에서의 재생을 막은 것일 수 있으니 위의 원본 링크 열기를 써 보세요. 장면은 화면 캡처(<kbd className="rounded border border-white/20 px-1">Win+Shift+S</kbd> · <kbd className="rounded border border-white/20 px-1">⌘⇧4</kbd>) 후{' '}
        <kbd className="rounded border border-white/20 px-1">Ctrl+V</kbd> 로 붙여넣으면 보드에 담겨요.
      </p>
    </div>
  );
}

// ---------- 영상 파일: 재생 + 프레임 캡처 ----------
function Capture({ src, name, crossOrigin, sourceUrl, initialStart, onClose }: { src: string; name: string; crossOrigin: boolean; sourceUrl?: string; initialStart: number; onClose: () => void }) {
  const act = useStore.getState;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(24);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  // 현재 시간을 부드럽게 표시
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setT((prev) => (prev === v.currentTime ? prev : v.currentTime));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (to: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.min(Math.max(0, to), v.duration || to);
  };
  const step = (frames: number) => seek((videoRef.current?.currentTime ?? 0) + frames / fps);
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || busy.current) return;
    if (!v.videoWidth) return act().toast('영상이 아직 준비되지 않았습니다.', { kind: 'error' });
    busy.current = true;
    try {
      v.pause();
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((resolve) => {
        try {
          c.toBlob(resolve, 'image/png');
        } catch {
          resolve(null);
        }
      });
      if (!blob) {
        act().toast('이 영상은 보안 설정(CORS) 때문에 캡처할 수 없습니다. 파일로 직접 열어 보세요.', { kind: 'error' });
        return;
      }
      const tc = fmtTimecode(v.currentTime);
      const base = name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣-]+/g, '_').slice(0, 40) || 'frame';
      const source = sourceUrl ? `${sourceUrl.split('#')[0]}#t=${Math.floor(v.currentTime)}` : name;
      await act().addFiles([new File([blob], `${base}_${tc.replace(/[:.]/g, '-')}.png`, { type: 'image/png' })], { title: tc, content: source });
      setCount((n) => n + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 140);
    } finally {
      busy.current = false;
    }
  };

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let handled = true;
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') toggle();
      else if (e.key === ',') step(-1);
      else if (e.key === '.') step(1);
      else if (e.key === 'ArrowLeft') seek((videoRef.current?.currentTime ?? 0) - (e.shiftKey ? 5 : 1));
      else if (e.key === 'ArrowRight') seek((videoRef.current?.currentTime ?? 0) + (e.shiftKey ? 5 : 1));
      else if (e.key === 'c' || e.key === 'C') void capture();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {failed ? (
          <p className="max-w-sm text-center text-[14px] text-white/60">이 영상은 브라우저에서 재생할 수 없습니다.<br />(MP4/H.264 · WebM 형식을 권장합니다. 일부 .mov / HEVC 는 지원되지 않아요.)</p>
        ) : (
          <video
            ref={videoRef}
            src={src}
            crossOrigin={crossOrigin ? 'anonymous' : undefined}
            playsInline
            preload="auto"
            className="max-h-full max-w-full rounded-lg bg-black shadow-2xl"
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              if (initialStart) e.currentTarget.currentTime = initialStart;
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setFailed(true)}
            onClick={toggle}
          />
        )}
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/60" />}
      </div>

      <div className="shrink-0 space-y-3 px-4 pb-5 pt-3">
        <input type="range" aria-label="재생 위치" min={0} max={duration || 1} step={0.01} value={Math.min(t, duration || 1)} onChange={(e) => seek(Number(e.target.value))} className="w-full" disabled={failed} />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Ctl label="5초 뒤로 (Shift+←)" onClick={() => seek(t - 5)}>
            <SkipBack size={17} />
          </Ctl>
          <Ctl label="1프레임 뒤로 ( , )" onClick={() => step(-1)}>
            <ChevronsLeft size={18} />
          </Ctl>
          <Ctl label={playing ? '일시정지 (Space)' : '재생 (Space)'} onClick={toggle} big>
            {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </Ctl>
          <Ctl label="1프레임 앞으로 ( . )" onClick={() => step(1)}>
            <ChevronsRight size={18} />
          </Ctl>
          <Ctl label="5초 앞으로 (Shift+→)" onClick={() => seek(t + 5)}>
            <SkipForward size={17} />
          </Ctl>
          <span className="num mx-3 min-w-[116px] text-center text-[15px] font-semibold tabular-nums" aria-label="현재 타임코드">
            {fmtTimecode(t)}
          </span>
          <label className="flex items-center gap-1.5 text-[12px] text-white/50">
            프레임
            <select value={fps} onChange={(e) => setFps(Number(e.target.value))} aria-label="프레임 단위" className="h-8 rounded-lg border border-white/20 bg-[#0b0b0b] px-1.5 text-[13px] text-white">
              {[24, 25, 30, 50, 60].map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={() => void capture()} disabled={failed} className="ml-3 !bg-white !text-black">
            <Camera size={16} /> 이 장면 캡처 <Kbd>C</Kbd>
          </Button>
        </div>
        <p className="text-center text-[12px] text-white/40">
          {count > 0 ? `${count}장 캡처했어요 · 보드에 타임코드와 함께 담겨 있습니다. ` : '캡처하면 보드에 타임코드가 붙은 이미지 카드로 저장돼요. '}
          <Kbd>Space</Kbd> 재생 · <Kbd>,</Kbd> <Kbd>.</Kbd> 프레임 · <Kbd>←</Kbd> <Kbd>→</Kbd> 1초
        </p>
      </div>
    </div>
  );
}

function Ctl({ label, onClick, big, children }: { label: string; onClick: () => void; big?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`flex items-center justify-center rounded-full text-white transition hover:bg-white/15 ${big ? 'h-11 w-11 bg-white/10' : 'h-9 w-9'}`}>
      {children}
    </button>
  );
}
