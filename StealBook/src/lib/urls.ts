// 저장소 경로 → 실제로 볼 수 있는 주소.
// 여러 카드가 동시에 요청해도 한 번에 묶어서 받아오고, 받은 주소는 만료 전까지 재사용합니다.
// (같은 주소를 계속 쓰면 브라우저 캐시가 살아 있어 무료 전송량을 아낄 수 있습니다.)
import { useEffect, useSyncExternalStore } from 'react';
import { backend } from './backend';
import { readLS, writeLS } from './util';

type Entry = { url: string; exp: number };
const LS_KEY = 'stealbook.urls.v1';
const cache = new Map<string, Entry>();
const pending = new Set<string>();
const inflight = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

if (backend.mode === 'cloud') {
  const saved = readLS<Record<string, Entry>>(LS_KEY, {});
  const now = Date.now();
  for (const [k, v] of Object.entries(saved)) if (v.exp > now + 3600_000) cache.set(k, v);
}

function persist() {
  if (backend.mode !== 'cloud') return;
  const obj: Record<string, Entry> = {};
  for (const [k, v] of cache) obj[k] = v;
  writeLS(LS_KEY, obj);
}

export const isExternal = (p: string) => /^(https?:|blob:|data:)/.test(p);

/** 지금 바로 쓸 수 있는 주소 (없으면 undefined) */
export function peekUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (isExternal(path)) return path;
  const e = cache.get(path);
  return e && e.exp > Date.now() + 60_000 ? e.url : undefined;
}

export function requestUrl(path: string) {
  if (!path || isExternal(path) || inflight.has(path) || failed.has(path) || peekUrl(path)) return;
  pending.add(path);
  if (!timer) timer = setTimeout(flush, 16);
}

async function flush() {
  timer = null;
  const paths = [...pending];
  pending.clear();
  if (!paths.length) return;
  paths.forEach((p) => inflight.add(p));
  try {
    const map = await backend.signUrls(paths);
    const exp = Date.now() + (isFinite(backend.urlTtlMs) ? backend.urlTtlMs - 86_400_000 : 1e15);
    for (const p of paths) {
      if (map[p]) cache.set(p, { url: map[p], exp });
      else failed.add(p);
    }
    persist();
  } catch {
    paths.forEach((p) => setTimeout(() => failed.delete(p), 30_000));
    paths.forEach((p) => failed.add(p));
  } finally {
    paths.forEach((p) => inflight.delete(p));
    version++;
    listeners.forEach((l) => l());
  }
}

/** 여러 경로를 한꺼번에 기다려서 받기 (내보내기 등) */
export async function resolveUrls(paths: string[]): Promise<Record<string, string>> {
  const need = paths.filter((p) => p && !peekUrl(p));
  if (need.length) {
    const map = await backend.signUrls(need);
    const exp = Date.now() + (isFinite(backend.urlTtlMs) ? backend.urlTtlMs - 86_400_000 : 1e15);
    for (const [k, v] of Object.entries(map)) cache.set(k, { url: v, exp });
    persist();
  }
  const out: Record<string, string> = {};
  for (const p of paths) {
    const u = peekUrl(p);
    if (u) out[p] = u;
  }
  return out;
}

/** 방금 올린 파일은 로컬 미리보기 주소를 잠시 써서 바로 보이게 */
export function primeUrl(path: string, url: string, ms = 10 * 60_000) {
  cache.set(path, { url, exp: Date.now() + ms });
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUrl(path: string | null | undefined): string | undefined {
  useSyncExternalStore(subscribe, () => version);
  const url = peekUrl(path);
  useEffect(() => {
    if (path && !url) requestUrl(path);
  }, [path, url]);
  return url;
}
