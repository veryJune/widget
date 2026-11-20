// 붙여넣은 임베드 코드(<iframe …>)를 해석 (화면과 무관한 순수 함수)
//  - YouTube / Vimeo 임베드 코드 → 일반 영상 링크로 바꿔서 기존 영상 카드(시작 시간 지정 등)로 처리
//  - 그 밖의 https 플레이어 → 임베드 카드 (src · 제목 · 크기만 뽑고 나머지 html 은 버림)
import { parseVideo, withStart } from './video';

export interface EmbedCode {
  /** 플레이어 주소 (https) */
  src: string;
  title: string;
  w: number | null;
  h: number | null;
}

export type ParsedEmbedCode = { kind: 'video-link'; url: string } | { kind: 'embed'; embed: EmbedCode };

function decode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? '');
  return out;
}

const px = (v: string | undefined): number | null => {
  const n = Number(String(v ?? '').replace(/px$/i, ''));
  return Number.isFinite(n) && n > 0 && n < 20000 ? Math.round(n) : null;
};

/** https 주소만 (프로토콜 생략 '//host/…' 는 https 로). 아니면 null */
export function httpsOnly(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  try {
    const u = new URL(v.startsWith('//') ? `https:${v}` : v);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** 텍스트에 <iframe …> 가 있으면 해석. 아니면 null */
export function parseEmbedCode(text: string): ParsedEmbedCode | null {
  const tag = text.match(/<iframe\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const a = attrsOf(tag);
  const src = httpsOnly(a.src || a['data-src']);
  if (!src) return null;

  // YouTube / Vimeo 는 일반 영상 링크로 (시작 시간까지 이어짐)
  const v = parseVideo(src);
  if (v && (v.kind === 'youtube' || v.kind === 'vimeo')) {
    const base = v.kind === 'youtube' ? `https://www.youtube.com/watch?v=${v.id}` : `https://vimeo.com/${v.id}`;
    return { kind: 'video-link', url: withStart({ ...v, url: base }, v.start) };
  }
  return { kind: 'embed', embed: { src, title: (a.title ?? '').slice(0, 300), w: px(a.width), h: px(a.height) } };
}
