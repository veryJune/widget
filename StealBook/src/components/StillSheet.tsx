// 영상 스틸 시트: 올린 영상에서 고르게(또는 구간 북마크 지점에서) 장면을 뽑아 한 장짜리 콘택트 시트로
// 레퍼런스 영상의 컷 구성·리듬을 한눈에 보거나, 콘티 회의 자료로 씁니다.
import { useEffect, useRef, useState } from 'react';
import { Download, FileDown, ImagePlus, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { useCompact } from '../hooks/useMedia';
import { canvasBlob, canvasToPdf, download, FONT, stamp } from '../lib/board';
import { emptyDraft, titleOf } from '../lib/capture';
import { resolveUrls } from '../lib/urls';
import type { Item, MediaFile } from '../lib/types';
import { Button, Modal } from './ui';

interface Frame {
  t: number;
  img: HTMLCanvasElement;
  note?: string;
}

/** 00:12.4 / 1:02:03 */
export function tc(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = s.toFixed(1).padStart(4, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss.slice(0, 2)}` : `${String(m).padStart(2, '0')}:${ss}`;
}

function seek(v: HTMLVideoElement, t: number) {
  return new Promise<void>((res, rej) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      v.removeEventListener('error', fail);
      res();
    };
    const fail = () => rej(new Error('영상을 읽지 못했습니다.'));
    v.addEventListener('seeked', done);
    v.addEventListener('error', fail);
    v.currentTime = t;
  });
}

async function openVideo(src: string, cors: boolean): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  if (cors) v.crossOrigin = 'anonymous';
  v.src = src;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error('영상을 불러오지 못했습니다.'));
    setTimeout(() => rej(new Error('영상을 불러오는 데 너무 오래 걸립니다.')), 30000);
  });
  return v;
}

/** 영상에서 장면 뽑기. 다른 서버 영상이라 캔버스가 막히면 통째로 받아서 다시 시도 */
async function extract(m: MediaFile, times: number[], onStep: (n: number) => void): Promise<Frame[]> {
  const url = (await resolveUrls([m.path]))[m.path];
  if (!url) throw new Error('영상 주소를 받지 못했습니다.');
  let v = await openVideo(url, !url.startsWith('blob:'));
  const grab = async (t: number) => {
    await seek(v, Math.min(Math.max(0, t), (v.duration || t) - 0.05));
    const w = Math.min(960, v.videoWidth);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.round((w * v.videoHeight) / v.videoWidth);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    c.getContext('2d')!.getImageData(0, 0, 1, 1); // 막혔는지 확인 (막히면 여기서 오류)
    return c;
  };
  const out: Frame[] = [];
  for (let k = 0; k < times.length; k++) {
    try {
      out.push({ t: times[k], img: await grab(times[k]) });
    } catch (e) {
      if (k === 0 && (e as Error).name === 'SecurityError') {
        const blob = await (await fetch(url)).blob();
        v = await openVideo(URL.createObjectURL(blob), false);
        out.push({ t: times[k], img: await grab(times[k]) });
      } else throw e;
    }
    onStep(k + 1);
  }
  return out;
}

type Mode = 'even' | 'markers';

function render(item: Item, m: MediaFile, frames: Frame[], cols: number, showTc: boolean): HTMLCanvasElement {
  const fw = frames[0]?.img.width || 960;
  const fh = frames[0]?.img.height || 540;
  const cellW = 480;
  const cellH = Math.round((cellW * fh) / fw);
  const pad = 40;
  const gap = 12;
  const labelH = showTc ? 34 : 0;
  const headH = 96;
  const rows = Math.ceil(frames.length / cols);
  const W = pad * 2 + cols * cellW + (cols - 1) * gap;
  const H = pad * 2 + headH + rows * (cellH + labelH) + (rows - 1) * gap;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ededed';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(titleOf(item), pad, pad + 36);
  ctx.fillStyle = '#8a8a8a';
  ctx.font = `500 18px ${FONT}`;
  const meta = [m.w && m.h ? `${m.w}×${m.h}` : '', m.duration ? `길이 ${tc(m.duration)}` : '', `${frames.length}장`, 'Steal Book'].filter(Boolean).join('  ·  ');
  ctx.fillText(meta, pad, pad + 70);
  frames.forEach((f, k) => {
    const x = pad + (k % cols) * (cellW + gap);
    const y = pad + headH + Math.floor(k / cols) * (cellH + labelH + gap);
    ctx.drawImage(f.img, x, y, cellW, cellH);
    if (showTc) {
      ctx.fillStyle = '#ededed';
      ctx.font = `600 17px ui-monospace, 'SFMono-Regular', Consolas, monospace`;
      ctx.fillText(`${String(k + 1).padStart(2, '0')}  ${tc(f.t)}`, x, y + cellH + 24);
      if (f.note) {
        ctx.fillStyle = '#8a8a8a';
        ctx.font = `500 15px ${FONT}`;
        const w0 = ctx.measureText(`${String(k + 1).padStart(2, '0')}  ${tc(f.t)}  `).width;
        let n = f.note;
        while (n && ctx.measureText(n).width > cellW - w0 - 20) n = n.slice(0, -1);
        ctx.fillText(n === f.note ? n : n + '…', x + w0 + 12, y + cellH + 24);
      }
    }
  });
  return cv;
}

export function StillSheet({ item, m, open, onClose }: { item: Item; m: MediaFile; open: boolean; onClose: () => void }) {
  const { submitDraft, toast } = useStore();
  const compact = useCompact();
  const markers = [...item.markers].sort((a, b) => a.start - b.start);
  const [count, setCount] = useState(12);
  const [cols, setCols] = useState(4);
  const [mode, setMode] = useState<Mode>('even');
  const [showTc, setShowTc] = useState(true);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState('');
  const run = useRef(0);

  const total = mode === 'markers' ? markers.length : count;

  // 장면 뽑기 (개수·방식이 바뀔 때만)
  useEffect(() => {
    if (!open) return;
    const id = ++run.current;
    setFrames(null);
    setErr('');
    setStep(0);
    const dur = m.duration || 0;
    const times =
      mode === 'markers' ? markers.map((x) => x.start) : Array.from({ length: count }, (_, k) => (dur * (k + 0.5)) / count);
    extract(m, times, (n) => id === run.current && setStep(n))
      .then((fs) => {
        if (id !== run.current) return;
        if (mode === 'markers') fs.forEach((f, k) => (f.note = markers[k]?.note));
        setFrames(fs);
      })
      .catch((e) => id === run.current && setErr((e as Error).message));
  }, [open, count, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!frames?.length) return;
    setPreview(render(item, m, frames, cols, showTc).toDataURL('image/jpeg', 0.85));
  }, [frames, cols, showTc]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = `${titleOf(item).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40)}-스틸-${stamp()}`;
  const make = () => render(item, m, frames!, cols, showTc);
  const act = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try {
      await fn();
    } catch {
      toast('만들지 못했습니다.', { kind: 'error' });
    } finally {
      setBusy('');
    }
  };

  const seg = (on: boolean) => `h-8 flex-1 whitespace-nowrap rounded-md px-2 text-[13px] font-semibold transition ${on ? 'bg-raise text-ink shadow-sm' : 'text-mute hover:text-ink'}`;
  const ready = !!frames?.length && !busy;

  return (
    <Modal open={open} onClose={onClose} title="스틸 시트" width={1040} full={compact}>
      <div className={`flex min-h-0 ${compact ? 'flex-col' : 'h-[min(76dvh,720px)]'}`}>
        <div className={`scroll-thin grid min-h-0 flex-1 place-items-center overflow-auto bg-bg p-4 ${compact ? 'h-[44dvh]' : ''}`}>
          {err ? (
            <p className="max-w-sm text-center text-[14px] text-mute">{err}</p>
          ) : !frames ? (
            <p className="flex items-center gap-2 text-[14px] text-mute">
              <Loader2 size={16} className="animate-spin" /> 장면 뽑는 중 {step}/{total}
            </p>
          ) : (
            preview && <img src={preview} alt="스틸 시트 미리보기" className="max-h-full max-w-full rounded-md shadow-lg" />
          )}
        </div>
        <div className={`scroll-thin shrink-0 space-y-4 p-5 ${compact ? '' : 'w-[300px] overflow-y-auto border-l border-line'}`}>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">뽑는 방식</span>
            <div className="flex gap-1 rounded-lg bg-bg p-1">
              <button type="button" className={seg(mode === 'even')} onClick={() => setMode('even')}>
                고르게
              </button>
              <button type="button" className={seg(mode === 'markers')} disabled={!markers.length} onClick={() => setMode('markers')} title={markers.length ? '' : '구간 북마크가 없습니다 (재생 중 I · O)'}>
                구간 북마크 {markers.length ? `(${markers.length})` : ''}
              </button>
            </div>
          </div>
          {mode === 'even' && (
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold text-faint">장 수</span>
              <div className="flex gap-1 rounded-lg bg-bg p-1">
                {[9, 12, 16, 24, 36].map((n) => (
                  <button key={n} type="button" className={seg(count === n)} onClick={() => setCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">한 줄 개수</span>
            <div className="flex gap-1 rounded-lg bg-bg p-1">
              {[3, 4, 5, 6].map((n) => (
                <button key={n} type="button" className={seg(cols === n)} onClick={() => setCols(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={showTc} onChange={(e) => setShowTc(e.target.checked)} className="h-4 w-4 accent-[var(--mark)]" /> 번호 · 시간 표시
          </label>
          <div className={`grid gap-2 border-t border-line pt-4 ${compact ? 'sticky bottom-0 -mx-5 bg-panel px-5 pb-[max(16px,env(safe-area-inset-bottom))]' : ''}`}>
            <Button variant="primary" disabled={!ready} onClick={() => act('png', async () => download(await canvasBlob(make()), `${name}.png`))}>
              {busy === 'png' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PNG 내려받기
            </Button>
            <Button disabled={!ready} onClick={() => act('pdf', async () => download(await canvasToPdf(make()), `${name}.pdf`))}>
              {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF 내려받기
            </Button>
            <Button
              disabled={!ready}
              onClick={() =>
                act('item', async () => {
                  const blob = await canvasBlob(make());
                  const d = emptyDraft(item.category_id);
                  d.title = `${titleOf(item)} · 스틸 시트`;
                  d.tags = [...new Set([...item.tags, '스틸시트'])];
                  d.files = [new File([blob], `${name}.png`, { type: 'image/png' })];
                  onClose();
                  await submitDraft(d);
                })
              }
            >
              <ImagePlus size={15} /> 새 항목으로 담기
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
