// 자잘한 도우미 함수 모음
import type { AspectBucket } from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const nowIso = () => new Date().toISOString();

/** 초 → 0:12 / 1:02:03 */
export function fmtTime(sec: number | undefined): string {
  if (sec == null || !isFinite(sec)) return '';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(r).padStart(2, '0')}`;
}

/** "1:23" / "83" / "1:02:03" → 초 */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((p) => !isFinite(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)}KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)}MB`;
  return `${(n / 1024 ** 3).toFixed(2)}GB`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('ko-KR', sameYear ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' });
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, '');
  } catch {
    return '';
  }
}

export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

/** 글 속에서 첫 번째 주소를 찾아 분리 (안드로이드 공유는 "제목 https://…" 형태가 많음) */
export function splitUrl(text: string): { url: string; rest: string } {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return { url: '', rest: text.trim() };
  const url = m[0].replace(/[),.]+$/, '');
  const rest = (text.slice(0, m.index) + text.slice((m.index || 0) + m[0].length)).replace(/\s+/g, ' ').trim();
  return { url, rest };
}

export function aspectBucket(ratio: number | null | undefined): AspectBucket | null {
  if (!ratio || !isFinite(ratio)) return null;
  if (ratio < 0.7) return 'tall';
  if (ratio < 0.92) return 'portrait';
  if (ratio <= 1.1) return 'square';
  if (ratio < 2.0) return 'wide';
  return 'scope';
}

export const ASPECTS: { id: AspectBucket; label: string; w: number; h: number }[] = [
  { id: 'tall', label: '세로 9:16', w: 9, h: 16 },
  { id: 'portrait', label: '4:5', w: 4, h: 5 },
  { id: 'square', label: '정사각 1:1', w: 1, h: 1 },
  { id: 'wide', label: '가로 16:9', w: 16, h: 9 },
  { id: 'scope', label: '와이드 2.39:1', w: 2.39, h: 1 },
];

export function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, '');
}

export function extOf(name: string, mime: string): string {
  const m = name.match(/\.([a-z0-9]{1,5})$/i);
  if (m) return m[1].toLowerCase();
  const fromMime = mime.split('/')[1] || 'bin';
  return fromMime.replace('jpeg', 'jpg').replace('quicktime', 'mov').slice(0, 5);
}

export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

export function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간 부족 등은 무시 */
  }
}
