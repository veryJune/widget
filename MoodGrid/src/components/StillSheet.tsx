// 자동 스틸 시트: 영상에서 장면을 한꺼번에 뽑아 보드에 (선택 시 새 섹션으로) 담음
import { useEffect, useRef, useState } from 'react';
import { Clapperboard, X } from 'lucide-react';
import { useStore } from '../store';
import { MAX_STILLS, evenTimes, intervalTimes, type Sensitivity, type StillMode } from '../lib/stills';
import { findSceneStarts, grabFrame, seekTo } from '../lib/videoFrames';
import { fmtStart, fmtTimecode, parseTimeInput } from '../lib/video';
import { Button } from './ui';

const MODES: { v: StillMode; label: string }[] = [
  { v: 'even', label: '균등 N장' },
  { v: 'interval', label: '간격(초)' },
  { v: 'scenes', label: '장면 전환' },
];
const SENS: { v: Sensitivity; label: string }[] = [
  { v: 'low', label: '둔감' },
  { v: 'normal', label: '보통' },
  { v: 'high', label: '민감' },
];

/** 화면에 보이는 영상과 따로, 보이지 않는 <video> 로 뽑아서 재생 중인 화면을 건드리지 않음 */
function loadHidden(src: string, crossOrigin: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    if (crossOrigin) v.crossOrigin = 'anonymous';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('영상을 열지 못했습니다.'));
    v.src = src;
  });
}

const nameBase = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣-]+/g, '_').slice(0, 40) || 'frame';

export function StillSheet({ src, name, crossOrigin, sourceUrl, duration, onClose, onDone }: { src: string; name: string; crossOrigin: boolean; sourceUrl?: string; duration: number; onClose: () => void; onDone: () => void }) {
  const act = useStore.getState;
  const busy = useStore((s) => s.busy);
  const [mode, setMode] = useState<StillMode>('even');
  const [count, setCount] = useState('12');
  const [stepSec, setStepSec] = useState('5');
  const [sens, setSens] = useState<Sensitivity>('normal');
  const [maxScenes, setMaxScenes] = useState('40');
  const [from, setFrom] = useState('0');
  const [to, setTo] = useState(fmtStart(duration));
  const [group, setGroup] = useState(true);
  const [error, setError] = useState('');
  const acRef = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => () => acRef.current?.abort(), []);

  const start = parseTimeInput(from) ?? 0;
  const end = Math.min(duration, parseTimeInput(to) ?? duration);
  const num = (s: string, d: number) => (Number.isFinite(Number(s)) && Number(s) > 0 ? Number(s) : d);

  // 미리 알 수 있는 장수 (장면 전환은 분석 후에 결정)
  const planned = mode === 'even' ? Math.min(MAX_STILLS, Math.round(num(count, 12))) : mode === 'interval' ? intervalTimes(start, end, num(stepSec, 5)).length : null;

  const run = async () => {
    setError('');
    if (!(end > start)) return setError('끝 시간이 시작 시간보다 뒤여야 합니다.');
    if (busy) return setError('다른 작업이 끝난 뒤에 다시 시도해 주세요.');
    const ac = new AbortController();
    acRef.current = ac;
    setRunning(true);
    const label = '스틸 시트 만드는 중';
    const cancel = () => ac.abort();
    act().setBusy({ label: '영상 여는 중', done: 0, total: 1, cancel });
    let made = 0;
    try {
      const v = await loadHidden(src, crossOrigin);
      let times: number[];
      if (mode === 'even') times = evenTimes(start, end, num(count, 12));
      else if (mode === 'interval') times = intervalTimes(start, end, num(stepSec, 5));
      else {
        act().setBusy({ label: '장면 찾는 중', done: 0, total: 1, cancel });
        times = await findSceneStarts(v, start, end, sens, Math.min(MAX_STILLS, Math.round(num(maxScenes, 40))), ac.signal, (done, total) => act().setBusy({ label: '장면 찾는 중', done, total, cancel }));
      }
      if (!times.length) throw new Error('뽑을 장면이 없습니다. 구간을 확인해 주세요.');

      const base = nameBase(name);
      const source = sourceUrl ? sourceUrl.split('#')[0] : name;
      let sectionId: string | null = null;
      for (let i = 0; i < times.length; i++) {
        if (ac.signal.aborted) break;
        act().setBusy({ label, done: i, total: times.length, cancel });
        await seekTo(v, times[i]);
        const blob = await grabFrame(v);
        if (!blob) throw new Error('이 영상은 보안 설정(CORS) 때문에 장면을 뽑을 수 없습니다. 파일로 직접 열어 보세요.');
        if (group && !sectionId) sectionId = act().addDivider(`${base} · 스틸 시트`);
        const tc = fmtTimecode(times[i]);
        const content = sourceUrl ? `${source}#t=${Math.floor(times[i])}` : name;
        await act().addFiles([new File([blob], `${base}_${tc.replace(/[:.]/g, '-')}.png`, { type: 'image/png' })], { title: tc, content }, { sectionId, quiet: true });
        made++;
      }
      if (ac.signal.aborted) act().toast(made ? `취소했어요. ${made}장은 보드에 담겨 있습니다.` : '취소했습니다.');
      else act().toast(`스틸 시트 ${made}장을 만들었습니다.`, { action: { label: '닫고 보기', run: onDone } });
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') act().toast(made ? `취소했어요. ${made}장은 보드에 담겨 있습니다.` : '취소했습니다.');
      else {
        setError(err.message || '스틸 시트를 만들지 못했습니다.');
        if (made) act().toast(`${made}장을 만든 뒤 멈췄습니다. (${err.message})`, { kind: 'error' });
      }
    } finally {
      acRef.current = null;
      setRunning(false);
      act().setBusy(null);
    }
  };

  const field = 'h-9 w-full rounded-lg border border-white/20 bg-[#0b0b0b] px-2.5 text-[13px] text-white focus:border-white/60 focus:outline-none';
  const lbl = 'mb-1 block text-[11.5px] font-semibold text-white/50';
  return (
    <div role="region" aria-label="자동 스틸 시트" className="mx-auto w-full max-w-[720px] rounded-xl border border-white/15 bg-[#121212] p-4 text-white">
      <div className="mb-3 flex items-center gap-2">
        <Clapperboard size={16} className="text-white/70" />
        <h3 className="flex-1 text-[14px] font-bold">자동 스틸 시트</h3>
        <button type="button" aria-label="스틸 시트 닫기" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10">
          <X size={15} />
        </button>
      </div>

      <div className="mb-3 inline-flex rounded-lg bg-white/8 p-0.5" role="radiogroup" aria-label="뽑는 방식">
        {MODES.map((m) => (
          <button key={m.v} type="button" role="radio" aria-checked={mode === m.v} onClick={() => setMode(m.v)} className={`h-8 rounded-md px-3 text-[13px] font-semibold transition ${mode === m.v ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {mode === 'even' && (
          <label>
            <span className={lbl}>장수 (최대 {MAX_STILLS})</span>
            <input aria-label="장수" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={field} />
          </label>
        )}
        {mode === 'interval' && (
          <label>
            <span className={lbl}>간격 (초)</span>
            <input aria-label="간격(초)" inputMode="decimal" value={stepSec} onChange={(e) => setStepSec(e.target.value)} className={field} />
          </label>
        )}
        {mode === 'scenes' && (
          <>
            <div>
              <span className={lbl}>민감도</span>
              <div className="inline-flex rounded-lg bg-white/8 p-0.5" role="radiogroup" aria-label="민감도">
                {SENS.map((s) => (
                  <button key={s.v} type="button" role="radio" aria-checked={sens === s.v} onClick={() => setSens(s.v)} className={`h-8 rounded-md px-2.5 text-[12.5px] font-semibold ${sens === s.v ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span className={lbl}>최대 장수</span>
              <input aria-label="최대 장수" inputMode="numeric" value={maxScenes} onChange={(e) => setMaxScenes(e.target.value)} className={field} />
            </label>
          </>
        )}
        <label>
          <span className={lbl}>시작</span>
          <input aria-label="시작 시간" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label>
          <span className={lbl}>끝</span>
          <input aria-label="끝 시간" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-white/80">
        <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} className="h-4 w-4" /> 새 섹션으로 묶기
      </label>

      <div className="mt-3 flex items-center gap-3">
        {running ? (
          <Button variant="quiet" onClick={() => acRef.current?.abort()} className="!bg-white/15 !text-white hover:!bg-white/25">
            취소
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void run()} disabled={!!busy || !(duration > 0)} className="!bg-white !text-black">
            스틸 시트 만들기
          </Button>
        )}
        <span className="text-[12.5px] text-white/50" aria-live="polite">
          {running && busy ? `${busy.label} ${busy.done}/${busy.total}` : error ? <span className="text-[#ff8a80]">{error}</span> : planned !== null ? `${planned}장 · ${fmtStart(start)} ~ ${fmtStart(end)}` : '컷이 바뀌는 곳을 찾아 각 장면의 첫 화면을 뽑습니다.'}
        </span>
      </div>
    </div>
  );
}
