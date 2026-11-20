// 자동 스틸 시트: 영상에서 뽑을 장면(시각)을 고르는 계산 (화면과 무관한 순수 함수)
//  - even:     구간을 n 등분해 각 조각의 한가운데 (맨 처음/끝의 검은 화면을 피함)
//  - interval: N초 간격
//  - scenes:   장면 전환(컷)을 찾아 각 장면의 첫 화면

export type StillMode = 'even' | 'interval' | 'scenes';

export const MAX_STILLS = 120;

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** [start, end] 를 n 등분한 조각의 가운데 시각들 */
export function evenTimes(start: number, end: number, n: number): number[] {
  const count = clampInt(n, 1, MAX_STILLS);
  const len = end - start;
  if (!(len > 0)) return [];
  return Array.from({ length: count }, (_, i) => round3(start + ((i + 0.5) * len) / count));
}

/** start 부터 step 초 간격 (end 전까지, 최대 max 장). 첫 장이 검은 화면이기 쉬워 0 초면 아주 조금 뒤로 */
export function intervalTimes(start: number, end: number, step: number, max = MAX_STILLS): number[] {
  if (!(step > 0) || !(end > start)) return [];
  const out: number[] = [];
  for (let t = start; t < end - 1e-6 && out.length < Math.min(max, MAX_STILLS); t += step) out.push(round3(t === 0 ? 0.05 : t));
  return out;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export type Sensitivity = 'low' | 'normal' | 'high';

/** 장면 전환 판단 기준(0~1, 인접한 두 화면의 평균 밝기 차이). 낮은 값일수록 더 많이 잡음 */
export const SENSITIVITY_THRESHOLD: Record<Sensitivity, number> = { low: 0.26, normal: 0.17, high: 0.1 };

/**
 * 샘플들의 시각(times)과 '바로 앞 샘플과의 차이'(diffs, diffs[0] 은 0)에서 각 장면의 시작 시각을 고름.
 *  - 차이가 threshold 를 넘는 곳이 컷
 *  - 컷 사이는 minGap 초 이상 (짧은 깜빡임/플래시는 무시)
 *  - 컷이 max-1 개를 넘으면 차이가 큰 것부터 남김
 *  - 맨 처음 시각은 항상 첫 장면의 시작으로 포함
 */
export function pickSceneStarts(times: number[], diffs: number[], opts: { threshold: number; minGap: number; max: number }): number[] {
  if (!times.length) return [];
  const cand: { t: number; d: number }[] = [];
  for (let i = 1; i < times.length; i++) if (diffs[i] > opts.threshold) cand.push({ t: times[i], d: diffs[i] });
  // 가까운 컷들 중 가장 큰 것만 (플래시 · 페이드 중복 제거)
  cand.sort((a, b) => a.t - b.t);
  const merged: { t: number; d: number }[] = [];
  for (const c of cand) {
    const last = merged[merged.length - 1];
    if (last && c.t - last.t < opts.minGap) {
      if (c.d > last.d) merged[merged.length - 1] = c;
    } else merged.push(c);
  }
  // 첫 장면과 너무 가까운 컷은 제외
  const firstT = times[0];
  const valid = merged.filter((c) => c.t - firstT >= opts.minGap);
  const room = Math.max(0, Math.min(opts.max, MAX_STILLS) - 1);
  const kept = valid.length > room ? [...valid].sort((a, b) => b.d - a.d).slice(0, room).sort((a, b) => a.t - b.t) : valid;
  return [firstT, ...kept.map((c) => c.t)].map(round3);
}

/** 두 개의 작은 흑백 화면(0~255)의 평균 밝기 차이를 0~1 로 */
export function lumaDiff(a: Uint8Array | Uint8ClampedArray, b: Uint8Array | Uint8ClampedArray): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n / 255;
}

/** 장면 분석에서 샘플 간격(초): 길이에 맞춰 샘플이 400개를 넘지 않게, 0.25~2초 */
export function sceneSampleStep(duration: number): number {
  return Math.min(2, Math.max(0.25, duration / 400));
}
