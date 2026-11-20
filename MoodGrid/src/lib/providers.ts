// 서비스별 '붙여넣은 링크 → 안에서 재생할 임베드 주소' 규칙 (화면과 무관한 순수 함수)
//  - 각 서비스가 공식으로 제공하는 임베드 주소 형식만 사용 (https 만)
//  - YouTube / Vimeo / 영상 파일은 lib/video.ts 가 따로 처리하므로 여기서는 다루지 않음
//  - 알 수 없는 링크는 null → 일반 링크 카드 (서버가 플레이어를 알려 주면 그때 재생 카드로)

export interface ResolvedEmbed {
  /** 안에서 재생할 플레이어 주소 */
  embed: string;
  /** 플레이어의 기본 가로 · 세로 (비율 계산용) */
  w: number;
  h: number;
}

const HOST_LABEL: [RegExp, string][] = [
  [/^open\.spotify\.com$/, 'Spotify'],
  [/^w\.soundcloud\.com$/, 'SoundCloud'],
  [/^(www\.)?dailymotion\.com$/, 'Dailymotion'],
  [/^streamable\.com$/, 'Streamable'],
  [/^(www\.)?loom\.com$/, 'Loom'],
  [/^fast\.wistia\.net$/, 'Wistia'],
  [/^(www\.)?figma\.com$/, 'Figma'],
  [/^(www\.)?behance\.net$/, 'Behance'],
  [/^(www\.)?instagram\.com$/, 'Instagram'],
  [/^(www\.)?tiktok\.com$/, 'TikTok'],
  [/^platform\.(twitter|x)\.com$/, 'X'],
  [/^drive\.google\.com$/, 'Google Drive'],
  [/^assets\.pinterest\.com$/, 'Pinterest'],
  [/^(www\.)?youtube(-nocookie)?\.com$/, 'YouTube'],
  [/^player\.vimeo\.com$/, 'Vimeo'],
];

/** 임베드 주소 → 보기 좋은 서비스 이름 (모르면 호스트 이름) */
export function embedLabel(embedUrl: string | null | undefined): string {
  if (!embedUrl) return '임베드';
  try {
    const host = new URL(embedUrl).hostname;
    for (const [re, name] of HOST_LABEL) if (re.test(host)) return name;
    return host.replace(/^www\./, '');
  } catch {
    return '임베드';
  }
}

/** 카드 · 재생 화면에 보일 문구: 아는 서비스는 이름만, 모르는 사이트는 '임베드 · 호스트' */
export function embedBadge(embedUrl: string | null | undefined): string {
  if (!embedUrl) return '임베드';
  try {
    const host = new URL(embedUrl).hostname;
    return HOST_LABEL.some(([re]) => re.test(host)) ? embedLabel(embedUrl) : `임베드 · ${embedLabel(embedUrl)}`;
  } catch {
    return '임베드';
  }
}

const SPOTIFY_TYPES: Record<string, number> = { track: 152, episode: 152, show: 232, album: 352, playlist: 352, artist: 352 };
const SOUNDCLOUD_RESERVED = new Set(['discover', 'stream', 'you', 'search', 'pages', 'upload', 'charts', 'settings', 'messages', 'notifications', 'tags', 'terms-of-use', 'imprint', 'popular', 'jobs', 'people', 'mobile', 'feed', 'creator-pro']);
const STREAMABLE_RESERVED = new Set(['login', 'signup', 'pricing', 'about', 'upload', 'terms', 'privacy', 'contact', 'blog', 'help', 'api']);

function parse(raw: string): { u: URL; host: string; seg: string[] } | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.toLowerCase().replace(/^www\.|^m\.|^mobile\./, '');
    return { u, host, seg: u.pathname.split('/').filter(Boolean) };
  } catch {
    return null;
  }
}

export function resolveEmbed(raw: string): ResolvedEmbed | null {
  const p = parse(raw);
  if (!p) return null;
  const { u, host } = p;
  let seg = p.seg;

  // Spotify: /track/ID · /intl-ko/track/ID · /album · /playlist · /episode · /show · /artist
  if (host === 'open.spotify.com') {
    if (seg[0] && /^intl-[a-z-]+$/i.test(seg[0])) seg = seg.slice(1);
    const [type, id] = seg;
    if (type in SPOTIFY_TYPES && id && /^[A-Za-z0-9]{22}$/.test(id)) return { embed: `https://open.spotify.com/embed/${type}/${id}`, w: 560, h: SPOTIFY_TYPES[type] };
    return null;
  }

  // SoundCloud: /사용자/곡 · /사용자/sets/목록 (짧은 on.soundcloud.com 주소는 서버가 풀어야 해서 제외)
  if (host === 'soundcloud.com') {
    if (seg.length < 2 || SOUNDCLOUD_RESERVED.has(seg[0].toLowerCase())) return null;
    const page = `https://soundcloud.com/${seg.map(encodeURIComponent).join('/')}`;
    return { embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(page)}&auto_play=false&hide_related=true&show_comments=false&visual=true`, w: 640, h: 360 };
  }

  // Dailymotion: /video/ID(_제목) · dai.ly/ID
  if (host === 'dailymotion.com' && seg[0] === 'video' && seg[1]) {
    const id = seg[1].split('_')[0];
    if (/^[a-z0-9]{5,}$/i.test(id)) return { embed: `https://www.dailymotion.com/embed/video/${id}`, w: 640, h: 360 };
    return null;
  }
  if (host === 'dai.ly' && seg[0] && /^[a-z0-9]{5,}$/i.test(seg[0])) return { embed: `https://www.dailymotion.com/embed/video/${seg[0]}`, w: 640, h: 360 };

  // Streamable: /ID · /e/ID
  if (host === 'streamable.com') {
    const id = seg[0] === 'e' || seg[0] === 'o' || seg[0] === 's' ? seg[1] : seg[0];
    if (id && /^[a-z0-9]{4,8}$/i.test(id) && !STREAMABLE_RESERVED.has(id.toLowerCase()) && seg.length <= 2) return { embed: `https://streamable.com/e/${id}`, w: 640, h: 360 };
    return null;
  }

  // Loom: /share/ID · /embed/ID
  if (host === 'loom.com' && (seg[0] === 'share' || seg[0] === 'embed') && seg[1] && /^[a-f0-9]{32}$/i.test(seg[1])) return { embed: `https://www.loom.com/embed/${seg[1]}`, w: 640, h: 360 };

  // Wistia: 계정.wistia.com/medias/ID · wi.st/medias/ID
  if ((host.endsWith('.wistia.com') || host === 'wistia.com' || host === 'wi.st') && seg[0] === 'medias' && seg[1] && /^[a-z0-9]{6,12}$/i.test(seg[1])) return { embed: `https://fast.wistia.net/embed/iframe/${seg[1]}`, w: 640, h: 360 };

  // Figma: /file · /design · /proto · /board · /slides
  if (host === 'figma.com' && ['file', 'design', 'proto', 'board', 'slides'].includes(seg[0]) && seg[1]) {
    const clean = `https://www.figma.com${u.pathname}${u.search}`;
    return { embed: `https://www.figma.com/embed?embed_host=moodgrid&url=${encodeURIComponent(clean)}`, w: 800, h: 450 };
  }

  // Behance: /gallery/ID/제목
  if (host === 'behance.net' && seg[0] === 'gallery' && seg[1] && /^\d{4,}$/.test(seg[1])) return { embed: `https://www.behance.net/embed/project/${seg[1]}?ilo0=1`, w: 404, h: 316 };

  // Instagram: /p/코드 · /reel/코드 · /reels/코드 · /tv/코드 · /사용자/p/코드
  if (host === 'instagram.com') {
    const i = seg.findIndex((s) => ['p', 'reel', 'reels', 'tv'].includes(s));
    const code = i >= 0 ? seg[i + 1] : undefined;
    if (i >= 0 && i <= 1 && code && /^[A-Za-z0-9_-]{5,}$/.test(code)) return { embed: `https://www.instagram.com/${seg[i] === 'reels' ? 'reel' : seg[i]}/${code}/embed/`, w: 540, h: 680 };
    return null;
  }

  // TikTok: /@사용자/video/숫자 (vm.tiktok.com 같은 짧은 주소는 서버가 풀어야 해서 제외)
  if (host === 'tiktok.com' && seg[0]?.startsWith('@') && seg[1] === 'video' && /^\d{15,22}$/.test(seg[2] ?? '')) return { embed: `https://www.tiktok.com/embed/v2/${seg[2]}`, w: 325, h: 740 };

  // X (트위터): /사용자/status/숫자
  if ((host === 'x.com' || host === 'twitter.com') && seg[1] === 'status' && /^\d{5,25}$/.test(seg[2] ?? '')) return { embed: `https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=dark&id=${seg[2]}`, w: 550, h: 700 };

  // Google Drive 영상/파일 미리보기: /file/d/ID/view
  if (host === 'drive.google.com' && seg[0] === 'file' && seg[1] === 'd' && /^[A-Za-z0-9_-]{10,}$/.test(seg[2] ?? '')) return { embed: `https://drive.google.com/file/d/${seg[2]}/preview`, w: 640, h: 360 };

  // Pinterest: /pin/숫자 (kr.pinterest.com 같은 지역 주소 포함)
  if ((host === 'pinterest.com' || host.endsWith('.pinterest.com')) && seg[0] === 'pin' && /^\d{6,}$/.test(seg[1] ?? '')) return { embed: `https://assets.pinterest.com/ext/embed.html?id=${seg[1]}`, w: 345, h: 520 };

  return null;
}
