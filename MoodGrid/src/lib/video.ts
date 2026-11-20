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

/** "83" · "1:23" · "1:02:03" · "1m23s" · "1h2m3s" → 초 (해석할 수 없으면 null) */
export function parseTimeInput(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.floor(Number(t));
  if (t.includes(':')) {
    const parts = t.split(':').map(Number);
    if (parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
    return Math.floor(parts.reduce((acc, p) => acc * 60 + p, 0));
  }
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return null;
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
    return { kind: 'youtube', id, start: parseTimeInput(startParam) ?? 0, url: u.href };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = host === 'vimeo.com' ? /^\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{5,})/.exec(u.pathname) : /^\/video\/(\d{5,})/.exec(u.pathname);
    if (!m) return null;
    return { kind: 'vimeo', id: m[1], start: parseTimeInput(startParam) ?? 0, url: u.href };
  }
  if (FILE_RE.test(u.pathname)) return { kind: 'file', id: '', start: parseTimeInput(startParam) ?? 0, url: u.href };
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
