// Steal Book — 링크 미리보기(언퍼얼) 서버리스 함수
//
// 브라우저는 다른 사이트의 HTML을 직접 읽을 수 없어서(CORS), 이 함수가 대신 페이지를 받아
// 제목·설명·대표 이미지·사이트명·파비콘과 oEmbed 정보(영상 크기, 썸네일)만 뽑아 돌려줍니다.
//
// 안전장치
//  - http/https 주소만, 내부망(사설 IP·localhost) 주소는 거부 (SSRF 방지)
//  - 리다이렉트는 최대 5번, 매번 주소를 다시 검사
//  - 7초 제한, HTML은 앞부분 800KB까지만 읽음
//  - Supabase가 설정돼 있으면 로그인한 사용자의 토큰이 있어야 응답
//
// 이 파일은 다른 파일을 import 하지 않습니다(배포 환경 호환을 위해 한 파일로 유지).

import { lookup } from 'node:dns/promises';
import net from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface UnfurlResult {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  imageW?: number;
  imageH?: number;
  site?: string;
  favicon?: string;
  /** 다른 사이트 안(iframe)에 띄워도 되는지 (X-Frame-Options, CSP frame-ancestors 확인) */
  frameable?: boolean;
  oembed?: {
    title?: string;
    width?: number;
    height?: number;
    thumbnail?: string;
    provider?: string;
  };
}

const TIMEOUT_MS = 7000;
const MAX_BYTES = 800_000;
const UA = 'Mozilla/5.0 (compatible; StealBook/0.1; link preview)';

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  return true;
}

async function assertPublic(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('http(s) 주소만 열 수 있습니다.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('내부 주소는 열 수 없습니다.');
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('내부 주소는 열 수 없습니다.');
}

async function readLimited(r: Response): Promise<string> {
  if (!r.body) return '';
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* ignore */ }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

async function safeFetch(start: string, accept: string): Promise<{ url: string; res: Response }> {
  let current = start;
  for (let hop = 0; hop < 6; hop++) {
    const u = new URL(current);
    await assertPublic(u);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(u, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, accept, 'accept-language': 'ko,en;q=0.8' },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, u).href;
        continue;
      }
      return { url: u.href, res };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('리다이렉트가 너무 많습니다.');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  return out;
}

function abs(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try { return new URL(href, base).href; } catch { return undefined; }
}

function knownOembed(pageUrl: string): string | null {
  const host = new URL(pageUrl).hostname.replace(/^www\.|^m\./, '');
  const q = encodeURIComponent(pageUrl);
  if (host === 'youtube.com' || host === 'youtu.be') return `https://www.youtube.com/oembed?format=json&url=${q}`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') return `https://vimeo.com/api/oembed.json?url=${q}`;
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return `https://www.tiktok.com/oembed?url=${q}`;
  return null;
}

async function fetchOembed(endpoint: string): Promise<UnfurlResult['oembed'] | undefined> {
  try {
    const { res } = await safeFetch(endpoint, 'application/json');
    if (!res.ok) return undefined;
    const j = JSON.parse(await readLimited(res)) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v ? Number(v) : undefined);
    return {
      title: typeof j.title === 'string' ? j.title : undefined,
      width: num(j.width),
      height: num(j.height),
      thumbnail: typeof j.thumbnail_url === 'string' ? j.thumbnail_url : undefined,
      provider: typeof j.provider_name === 'string' ? j.provider_name : undefined,
    };
  } catch {
    return undefined;
  }
}

/** 응답 헤더를 보고 이 페이지를 다른 사이트 안에 띄울 수 있는지 판단 */
export function frameableFrom(h: Headers): boolean {
  const xfo = (h.get('x-frame-options') || '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return false;
  const csp = h.get('content-security-policy') || '';
  const fa = csp
    .split(';')
    .map((s) => s.trim())
    .find((s) => /^frame-ancestors\b/i.test(s));
  if (fa) {
    const sources = fa.slice('frame-ancestors'.length).trim().toLowerCase().split(/\s+/);
    if (!sources.includes('*')) return false;
  }
  return true;
}

export async function unfurl(raw: string): Promise<UnfurlResult> {
  const input = (raw || '').trim();
  if (!input) throw new Error('주소가 비어 있습니다.');
  const { url, res } = await safeFetch(input, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5');
  const out: UnfurlResult = { url, site: new URL(url).hostname.replace(/^www\./, '') };

  const type = res.headers.get('content-type') || '';
  if (type.startsWith('image/')) {
    out.image = url;
    try { await res.body?.cancel(); } catch { /* ignore */ }
  } else if (type.includes('html') || !type) {
    out.frameable = frameableFrom(res.headers);
    const html = await readLimited(res);
    const head = html.slice(0, 400_000);
    const meta: Record<string, string> = {};
    for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
      const a = attrs(m[0]);
      const key = (a.property || a.name || a.itemprop || '').toLowerCase();
      if (key && a.content && !(key in meta)) meta[key] = a.content;
    }
    let oembedHref: string | undefined;
    let icon: string | undefined;
    for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
      const a = attrs(m[0]);
      const rel = (a.rel || '').toLowerCase();
      if (!icon && /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) icon = a.href;
      if (!oembedHref && rel === 'alternate' && /json\+oembed/i.test(a.type || '')) oembedHref = a.href;
    }
    const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    out.title = meta['og:title'] || meta['twitter:title'] || (titleTag ? decodeEntities(titleTag) : undefined);
    out.description = meta['og:description'] || meta['twitter:description'] || meta['description'];
    out.image = abs(meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || meta['twitter:image:src'], url);
    out.imageW = Number(meta['og:image:width']) || undefined;
    out.imageH = Number(meta['og:image:height']) || undefined;
    out.site = meta['og:site_name'] || out.site;
    out.favicon = abs(icon || '/favicon.ico', url);
    const endpoint = knownOembed(url) || abs(oembedHref, url);
    if (endpoint) out.oembed = await fetchOembed(endpoint);
  } else {
    try { await res.body?.cancel(); } catch { /* ignore */ }
  }

  if (!out.oembed) {
    const endpoint = knownOembed(url);
    if (endpoint) out.oembed = await fetchOembed(endpoint);
  }
  if (out.oembed?.title && !out.title) out.title = out.oembed.title;
  if (out.oembed?.thumbnail && !out.image) out.image = out.oembed.thumbnail;
  if (out.title && out.title.length > 300) out.title = out.title.slice(0, 300);
  if (out.description && out.description.length > 600) out.description = out.description.slice(0, 600);
  return out;
}

// ---------- 이미지 사본 받기 (이미지 주소를 붙여넣었을 때) ----------
// 브라우저는 다른 사이트 이미지를 파일로 읽을 수 없어서(CORS) 서버가 대신 받아 줍니다.
// 응답 크기 한도 때문에 4MB 까지만 (넘으면 앱이 원본 주소로 미리보기만 함)
const MAX_IMAGE = 4 * 1024 * 1024;

export async function fetchImage(raw: string): Promise<{ type: string; data: Uint8Array }> {
  const { res } = await safeFetch((raw || '').trim(), 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8');
  if (!res.ok) throw new Error(`이미지를 받지 못했습니다 (${res.status}).`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!type.startsWith('image/')) throw new Error('이미지 주소가 아닙니다.');
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_IMAGE) throw new Error('too-large');
  if (!res.body) throw new Error('빈 응답입니다.');
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.length;
    if (total > MAX_IMAGE) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error('too-large');
    }
    chunks.push(value);
  }
  const data = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { data.set(c, off); off += c.length; }
  return { type, data };
}

function send(res: ServerResponse, status: number, body: unknown, cache = false) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (cache) res.setHeader('cache-control', 'private, max-age=3600');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const target = new URL(req.url || '', 'http://localhost').searchParams.get('url') || '';

  // Supabase가 설정돼 있으면 로그인한 사용자만 쓸 수 있게 막습니다.
  const sbUrl = process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.VITE_SUPABASE_KEY;
  if (sbUrl && sbKey) {
    const auth = req.headers.authorization;
    if (!auth) return send(res, 401, { error: '로그인이 필요합니다.' });
    try {
      const r = await fetch(`${sbUrl.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: sbKey, authorization: auth } });
      if (!r.ok) return send(res, 401, { error: '로그인이 만료되었습니다. 다시 로그인하세요.' });
    } catch {
      return send(res, 502, { error: '인증 서버에 연결하지 못했습니다.' });
    }
  }

  const mode = new URL(req.url || '', 'http://localhost').searchParams.get('mode');
  if (mode === 'image') {
    try {
      const img = await fetchImage(target);
      res.statusCode = 200;
      res.setHeader('content-type', img.type);
      res.setHeader('cache-control', 'private, max-age=600');
      res.end(Buffer.from(img.data));
      return;
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      return send(res, msg === 'too-large' ? 413 : 400, { error: msg });
    }
  }

  try {
    return send(res, 200, await unfurl(target), true);
  } catch (e) {
    return send(res, 400, { error: String((e as Error)?.message || e) });
  }
}
