// 붙여넣은 주소(또는 <iframe> 코드)를 보고 임베드 플레이어 정보를 만듭니다.
// 지원: 유튜브(쇼츠 포함), 비메오, 인스타그램(게시물·릴스), 틱톡, X(트위터), 스포티파이, 일반 iframe 코드
import type { EmbedInfo } from './types';

export interface ParsedEmbed {
  url: string; // 원본(출처) 주소
  embed: EmbedInfo;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function youtube(u: URL): ParsedEmbed | null {
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
  let id = '';
  let shorts = false;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = u.searchParams.get('v') || '';
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
      id = parts[1] || '';
      shorts = parts[0] === 'shorts';
    }
  }
  if (!YT_ID.test(id)) return null;
  const t = u.searchParams.get('t') || u.searchParams.get('start') || '';
  // t=90, t=90s, t=1m30s, t=1h2m3s
  const hms = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  const start = hms ? Number(hms[1] || 0) * 3600 + Number(hms[2] || 0) * 60 + Number(hms[3] || 0) : 0;
  return {
    url: shorts ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
    embed: {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${id}?rel=0&playsinline=1${start ? `&start=${start}` : ''}`,
      aspect: shorts ? 9 / 16 : 16 / 9,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      seekable: true,
    },
  };
}

function vimeo(u: URL): ParsedEmbed | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;
  const m = u.pathname.match(/(?:\/video)?\/(\d{5,})(?:\/([a-z0-9]+))?/i);
  if (!m) return null;
  const hash = m[2] || u.searchParams.get('h') || '';
  return {
    url: `https://vimeo.com/${m[1]}${hash ? '/' + hash : ''}`,
    embed: {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ''}`,
      aspect: 16 / 9,
      seekable: true,
    },
  };
}

function instagram(u: URL): ParsedEmbed | null {
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host !== 'instagram.com' && host !== 'instagr.am') return null;
  const m = u.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
  if (!m) return null;
  const kind = m[1] === 'p' ? 'p' : 'reel';
  return {
    url: `https://www.instagram.com/${kind}/${m[2]}/`,
    embed: {
      provider: 'instagram',
      embedUrl: `https://www.instagram.com/${kind}/${m[2]}/embed/`,
      // 인스타그램 임베드는 위아래에 계정·설명 영역이 붙어서 세로로 더 깁니다.
      aspect: kind === 'p' ? 0.66 : 0.5,
    },
  };
}

function tiktok(u: URL): ParsedEmbed | null {
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (!host.endsWith('tiktok.com')) return null;
  const m = u.pathname.match(/\/video\/(\d+)/) || u.pathname.match(/\/(?:embed\/v2|player\/v1)\/(\d+)/);
  if (!m) return null; // vm.tiktok.com 같은 짧은 주소는 서버에서 풀어서 다시 확인
  return {
    url: u.href.split('?')[0],
    embed: { provider: 'tiktok', embedUrl: `https://www.tiktok.com/player/v1/${m[1]}?rel=0`, aspect: 9 / 16 },
  };
}

function xpost(u: URL): ParsedEmbed | null {
  const host = u.hostname.replace(/^www\.|^mobile\./, '');
  if (host !== 'x.com' && host !== 'twitter.com') return null;
  const m = u.pathname.match(/\/status(?:es)?\/(\d+)/);
  if (!m) return null;
  return {
    url: `https://x.com${u.pathname}`,
    embed: { provider: 'x', embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true`, aspect: 0.8 },
  };
}

function spotify(u: URL): ParsedEmbed | null {
  if (u.hostname !== 'open.spotify.com') return null;
  const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const compact = m[1] === 'track' || m[1] === 'episode';
  return {
    url: `https://open.spotify.com/${m[1]}/${m[2]}`,
    embed: {
      provider: 'spotify',
      embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
      aspect: compact ? 2.4 : 1,
      fixedHeight: compact ? 152 : 352,
    },
  };
}

/** <iframe src="…" width="…" height="…"> 코드 붙여넣기 */
function iframeCode(text: string): ParsedEmbed | null {
  if (!/<iframe\b/i.test(text)) return null;
  const src = text.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!src) return null;
  let fixed: ParsedEmbed | null = null;
  try {
    fixed = parseEmbed(src.startsWith('//') ? 'https:' + src : src, false);
  } catch {
    /* 아래 일반 처리 */
  }
  if (fixed) return fixed;
  const w = Number(text.match(/\bwidth\s*=\s*["']?(\d+)/i)?.[1]);
  const h = Number(text.match(/\bheight\s*=\s*["']?(\d+)/i)?.[1]);
  const url = src.startsWith('//') ? 'https:' + src : src;
  if (!/^https:\/\//i.test(url)) return null;
  return { url, embed: { provider: 'iframe', embedUrl: url, aspect: w && h ? w / h : 16 / 9 } };
}

export function parseEmbed(input: string, allowIframe = true): ParsedEmbed | null {
  const text = input.trim();
  if (!text) return null;
  if (allowIframe && text.startsWith('<')) return iframeCode(text);
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  return youtube(u) || vimeo(u) || instagram(u) || tiktok(u) || xpost(u) || spotify(u);
}

/** 영상 임베드의 시작 시각을 바꾼 주소 (구간 북마크 재생용) */
export function embedAt(embed: EmbedInfo, sec: number, autoplay = true): string {
  const s = Math.max(0, Math.floor(sec));
  if (embed.provider === 'youtube') {
    const u = new URL(embed.embedUrl);
    u.searchParams.set('start', String(s));
    if (autoplay) u.searchParams.set('autoplay', '1');
    return u.href;
  }
  if (embed.provider === 'vimeo') {
    const base = embed.embedUrl.split('#')[0];
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${autoplay ? `${sep}autoplay=1` : ''}#t=${s}s`;
  }
  return embed.embedUrl;
}

export const PROVIDER_LABEL: Record<EmbedInfo['provider'], string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  spotify: 'Spotify',
  iframe: '임베드',
};
