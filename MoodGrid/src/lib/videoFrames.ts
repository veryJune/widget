// <video> 요소에서 장면을 뽑는 브라우저 전용 도구 (자동 스틸 시트에서 사용)
import { SENSITIVITY_THRESHOLD, lumaDiff, pickSceneStarts, sceneSampleStep, type Sensitivity } from './stills';

/** 영상을 t 초로 옮기고 그 화면이 준비될 때까지 기다림 */
export function seekTo(v: HTMLVideoElement, t: number, timeoutMs = 10000): Promise<void> {
  const target = Math.min(Math.max(0, t), Math.max(0, (v.duration || t) - 0.001));
  return new Promise((resolve, reject) => {
    if (Math.abs(v.currentTime - target) < 0.0005 && v.readyState >= 2) return resolve();
    const done = () => {
      clearTimeout(timer);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      done();
      // 화면이 실제로 그려진 뒤에 읽도록 한 프레임 기다림
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    const onError = () => {
      done();
      reject(new Error('영상을 읽다가 오류가 났습니다.'));
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('영상의 해당 위치로 이동하지 못했습니다.'));
    }, timeoutMs);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('error', onError);
    v.currentTime = target;
  });
}

/** 지금 화면을 원본 해상도 PNG 로. 보안 설정(CORS) 때문에 읽을 수 없으면 null */
export function grabFrame(v: HTMLVideoElement): Promise<Blob | null> {
  if (!v.videoWidth) return Promise.resolve(null);
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
  return new Promise((resolve) => {
    try {
      c.toBlob(resolve, 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * 장면 전환 찾기: start~end 를 일정한 간격으로 훑어 인접한 화면의 차이가 큰 곳을 컷으로 봄.
 * 반환: 각 장면의 첫 화면 시각들 (맨 처음 포함)
 */
export async function findSceneStarts(v: HTMLVideoElement, start: number, end: number, sens: Sensitivity, max: number, signal: AbortSignal, onProgress?: (done: number, total: number) => void): Promise<number[]> {
  const step = sceneSampleStep(end - start);
  const W = 48;
  const H = 27;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('이 브라우저에서는 장면을 분석할 수 없습니다.');
  const times: number[] = [];
  const diffs: number[] = [];
  const total = Math.max(1, Math.floor((end - start) / step));
  let prev: Uint8Array | null = null;
  for (let t = start, i = 0; t <= end - 0.01; t += step, i++) {
    if (signal.aborted) throw new DOMException('취소했습니다.', 'AbortError');
    await seekTo(v, t);
    ctx.drawImage(v, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const luma = new Uint8Array(W * H);
    for (let k = 0; k < W * H; k++) luma[k] = Math.round(0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2]);
    diffs.push(prev ? lumaDiff(prev, luma) : 0);
    times.push(t);
    prev = luma;
    onProgress?.(i + 1, total);
  }
  return pickSceneStarts(times, diffs, { threshold: SENSITIVITY_THRESHOLD[sens], minGap: Math.max(0.8, step * 2), max });
}
