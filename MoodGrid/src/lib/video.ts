// 영상 링크 해석 · 시간 변환 (화면과 무관한 순수 함수)
//  - YouTube / Vimeo 주소 → 삽입(embed) 주소, 시작 시간
//  - 영상 파일 주소(.mp4 등) → 직접 재생 + 프레임 캡처
export type VideoKind = 'youtube' | 'vimeo' | 'file';

export interface VideoRef {
  kind: VideoKind;
  id: string; // youtube/vimeo 영상 id (file 은 '')
  start: number; // 시작 초
  url: string;
}

const FILE_RE = /\.(mp4|webm|mov|m4v|ogv)$/i;

/**
 * 시간 입력 → 초 (해석할 수 없으면 null). 편하게 쳐도 되도록 여러 형식을 받아요:
 *  - 숫자만: 오른쪽부터 초(2자리) · 분(2자리) · 시간 — 936 → 9:36, 1234 → 12:34, 10236 → 1:02:36, 45 → 0:45
 *  - 구분자(공백 · : . , - ): 9 36 → 9:36, 1 2 36 → 1:02:36, 9.36 → 9:36
 *  - 글자: 1m23s · 1h2m3s
 */
export function parseTimeInput(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const letters = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/.exec(t);
  if (letters && (letters[1] || letters[2] || letters[3])) return Number(letters[1] || 0) * 3600 + Number(letters[2] || 0) * 60 + Number(letters[3] || 0);
  if (!/^[\d\s:.,;·-]+$/.test(t)) return null;
  const parts = t.split(/[\s:.,;·-]+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) {
    // 숫자만: 시계처럼 오른쪽부터 채움 (최대 6자리 = 시·분·초 각 2자리)
    const d = parts[0];
    if (d.length > 6) return null;
    const sec = Number(d.slice(-2));
    const min = d.length > 2 ? Number(d.slice(-4, -2)) : 0;
    const hr = d.length > 4 ? Number(d.slice(0, -4)) : 0;
    return hr * 3600 + min * 60 + sec;
  }
  if (parts.length > 3 || parts.some((p) => p.length > 3)) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/**
 * 링크의 t= / start= 값 → 초. 사람이 치는 입력(parseTimeInput)과 달리 숫자만 있으면 '초 단위'입니다 (t=576 은 576초).
 * 지원: 576 · 576s · 1m23s · 1h2m3s · 83.5
 */
export function parseTimeParam(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+(\.\d+)?s?$/.test(t)) return Math.floor(Number(t.replace('s', '')));
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return null;
}

/** 입력창에 보여줄 미리보기: 936 → "9:36 (576초)". 해석할 수 없으면 null */
export function previewTime(text: string): string | null {
  const sec = parseTimeInput(text);
  return sec === null ? null : `${fmtStart(sec)} (${sec}초)`;
}

/** 초 → "1:23" / "1:02:03" */
export function fmtStart(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** 초 → "00:01:23.480" (프레임 캡처 타임코드) */
export function fmtTimecode(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

export function parseVideo(raw: string): VideoRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const startParam = (u.searchParams.get('t') ?? u.searchParams.get('start') ?? '') || (/^#t=(.+)$/.exec(u.hash)?.[1] ?? '');

  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.pathname === '/watch') id = u.searchParams.get('v') ?? '';
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([\w-]{6,})/.exec(u.pathname);
      id = m?.[1] ?? '';
    }
    if (!/^[\w-]{6,15}$/.test(id)) return null;
    return { kind: 'youtube', id, start: parseTimeParam(startParam) ?? 0, url: u.href };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = host === 'vimeo.com' ? /^\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{5,})/.exec(u.pathname) : /^\/video\/(\d{5,})/.exec(u.pathname);
    if (!m) return null;
    return { kind: 'vimeo', id: m[1], start: parseTimeParam(startParam) ?? 0, url: u.href };
  }
  if (FILE_RE.test(u.pathname)) return { kind: 'file', id: '', start: parseTimeParam(startParam) ?? 0, url: u.href };
  return null;
}

/** 안에서 재생할 삽입 주소 (youtube-nocookie / player.vimeo.com 만 사용) */
export function embedSrc(v: VideoRef): string | null {
  if (v.kind === 'youtube') return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&start=${v.start}`;
  if (v.kind === 'vimeo') return `https://player.vimeo.com/video/${v.id}#t=${v.start}s`;
  return null;
}

/** 링크의 시작 시간을 바꾼 새 주소 */
export function withStart(v: VideoRef, seconds: number): string {
  const u = new URL(v.url);
  const s = Math.max(0, Math.floor(seconds));
  if (v.kind === 'youtube') {
    u.searchParams.delete('start');
    if (s) u.searchParams.set('t', String(s));
    else u.searchParams.delete('t');
    u.hash = '';
  } else {
    u.searchParams.delete('t');
    u.hash = s ? `#t=${s}` : '';
  }
  return u.href;
}

export const PROVIDER_LABEL: Record<VideoKind, string> = { youtube: 'YouTube', vimeo: 'Vimeo', file: '영상 파일' };
