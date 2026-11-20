export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const nowIso = () => new Date().toISOString();

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** http/https 주소만 허용 (javascript: 등 차단). 통과하면 정규화된 주소, 아니면 null */
export function safeHttpUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value).trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

export function looksLikeImageUrl(url: string): boolean {
  try {
    return /\.(png|jpe?g|gif|webp|avif)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, '');
  } catch {
    return '';
  }
}

/** "방금" · "3분 전" · "어제" · "11월 3일" */
export function relTime(from: number | string | Date, now = Date.now()): string {
  const t = new Date(from).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return '방금';
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d === 1) return '어제';
  if (d < 7) return `${d}일 전`;
  const date = new Date(t);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('ko-KR', sameYear ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' });
}

export function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fileExt(name: string, mime: string): string {
  const fromName = name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return ({ 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/avif': 'avif' } as Record<string, string>)[mime] || 'jpg';
}
