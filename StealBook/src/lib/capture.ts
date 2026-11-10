// 담기: 글·파일·링크를 받아 하나의 항목(게시글)으로 만들어 저장합니다.
// 붙여넣기, 끌어다 놓기, 작성 창, 안드로이드 공유가 모두 이 파일을 거칩니다.
import { backend } from './backend';
import { parseEmbed } from './embed';
import { fileKind, imageSize, processImage, processVideo } from './media';
import type { EmbedInfo, Item, LinkMeta, MediaFile } from './types';
import { primeUrl } from './urls';
import { baseName, extOf, nowIso, splitUrl, uid } from './util';
import { looksLikeImageUrl } from './filter';

export const MAX_FILE_BYTES = backend.mode === 'cloud' ? 50 * 1024 * 1024 : 200 * 1024 * 1024;

export interface LinkPreview {
  url: string;
  embed: EmbedInfo | null;
  link: LinkMeta | null;
  /** 카드 비율 (가로/세로) */
  ratio: number | null;
  /** 주소 자체가 이미지 파일 (붙여넣으면 사본을 저장) */
  isImage?: boolean;
}

interface UnfurlResponse {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  imageW?: number;
  imageH?: number;
  site?: string;
  favicon?: string;
  oembed?: { width?: number; height?: number; thumbnail?: string; title?: string };
  frameable?: boolean;
}

async function unfurl(url: string): Promise<UnfurlResponse | null> {
  try {
    const token = await backend.accessToken();
    const r = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return null;
    return (await r.json()) as UnfurlResponse;
  } catch {
    return null;
  }
}

function cardRatio(embed: EmbedInfo): number {
  if (embed.provider === 'instagram') return embed.embedUrl.includes('/reel/') ? 9 / 16 : 4 / 5;
  if (embed.provider === 'spotify') return 1;
  if (embed.provider === 'x') return 1;
  return embed.aspect;
}

/** 주소 하나를 보고 임베드/링크 미리보기를 만듭니다. */
export async function previewLink(input: string): Promise<LinkPreview> {
  const text = input.trim();
  let parsed = parseEmbed(text);
  if (parsed?.embed.provider === 'iframe') return { url: parsed.url, embed: parsed.embed, link: null, ratio: parsed.embed.aspect };

  // 이미지 주소(…/poster.png 등): 바로 이미지로 다룹니다
  if (!parsed && looksLikeImageUrl(text)) {
    const s = await imageSize(text);
    return { url: text, embed: null, link: { image: text, site: hostOf(text) }, ratio: s ? s.w / s.h : null, isImage: true };
  }

  const meta = await unfurl(parsed?.url || text);
  if (!parsed && meta?.url && meta.url !== text) parsed = parseEmbed(meta.url); // 짧은 주소 풀기

  // 확장자는 없지만 실제로는 이미지인 주소 (서버가 이미지로 응답했거나, 서버 확인이 실패했는데 브라우저에선 이미지로 열림)
  if (!parsed && ((meta && meta.image === meta.url && !meta.title) || !meta)) {
    const s = await imageSize(meta?.url || text, 5000);
    if (s) return { url: meta?.url || text, embed: null, link: { image: meta?.url || text, site: hostOf(text) }, ratio: s.w / s.h, isImage: true };
  }

  let embed = parsed?.embed ?? null;
  if (embed) {
    const ow = meta?.oembed?.width;
    const oh = meta?.oembed?.height;
    if (embed.provider === 'vimeo' && ow && oh) embed = { ...embed, aspect: ow / oh };
    if (!embed.thumb) embed = { ...embed, thumb: meta?.oembed?.thumbnail || meta?.image };
  }
  const link: LinkMeta | null = meta
    ? { title: meta.oembed?.title || meta.title, description: meta.description, image: meta.image, site: meta.site, favicon: meta.favicon, frameable: meta.frameable }
    : { site: hostOf(text) };

  let ratio: number | null = embed ? cardRatio(embed) : null;
  if (!embed && link.image) {
    if (meta?.imageW && meta?.imageH) ratio = meta.imageW / meta.imageH;
    else {
      const s = await imageSize(link.image);
      ratio = s ? s.w / s.h : 1.91;
    }
  }
  return { url: parsed?.url || meta?.url || text, embed, link, ratio };
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 이미지 주소 → 파일 (서버가 대신 받아 줌, 4MB 넘거나 막히면 null) */
export async function fetchRemoteImage(url: string): Promise<File | null> {
  try {
    const token = await backend.accessToken();
    const r = await fetch(`/api/unfurl?mode=image&url=${encodeURIComponent(url)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) return null;
    let name = 'image';
    try {
      name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image') || 'image';
    } catch {
      /* 기본 이름 */
    }
    return new File([blob], name, { type: blob.type });
  } catch {
    return null;
  }
}

async function userPrefix(itemId: string) {
  const s = await backend.session();
  if (!s) throw new Error('로그인이 필요합니다.');
  return `${s.userId}/${itemId}/`;
}

/** 파일 하나를 압축·썸네일 처리 후 올립니다. */
export async function uploadFile(itemId: string, file: File, onProgress?: (fraction: number) => void): Promise<MediaFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" 파일이 너무 큽니다. ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB 이하로 줄여 주세요. (영상은 720p로 내보내면 대부분 줄어듭니다)`);
  }
  const prefix = await userPrefix(itemId);
  const key = uid().slice(0, 8);
  const kind = fileKind(file);

  if (kind === 'image') {
    const r = await processImage(file);
    const path = `${prefix}${key}.${r.main.ext}`;
    const thumb = `${prefix}${key}_t.${r.thumb.ext}`;
    await backend.upload(path, r.main.blob, r.main.mime, onProgress);
    await backend.upload(thumb, r.thumb.blob, r.thumb.mime);
    primeUrl(thumb, URL.createObjectURL(r.thumb.blob));
    return { path, kind, mime: r.main.mime, name: file.name, size: r.main.blob.size, w: r.w, h: r.h, thumb, thumbSize: r.thumb.blob.size, colors: r.colors };
  }

  if (kind === 'video') {
    let r: Awaited<ReturnType<typeof processVideo>> | null = null;
    try {
      r = await processVideo(file);
    } catch {
      r = null; // 미리보기를 못 만들어도 원본은 저장
    }
    const path = `${prefix}${key}.${extOf(file.name, file.type)}`;
    await backend.upload(path, file, file.type || 'video/mp4', onProgress);
    const mf: MediaFile = { path, kind, mime: file.type || 'video/mp4', name: file.name, size: file.size, w: r?.w, h: r?.h, duration: r?.duration, colors: r?.colors };
    if (r?.thumb) {
      mf.thumb = `${prefix}${key}_t.${r.thumb.ext}`;
      mf.thumbSize = r.thumb.blob.size;
      await backend.upload(mf.thumb, r.thumb.blob, r.thumb.mime);
      primeUrl(mf.thumb, URL.createObjectURL(r.thumb.blob));
    }
    if (r?.strip) {
      mf.strip = `${prefix}${key}_s.${r.strip.ext}`;
      mf.stripSize = r.strip.blob.size;
      mf.stripFrames = r.frames;
      await backend.upload(mf.strip, r.strip.blob, r.strip.mime);
      primeUrl(mf.strip, URL.createObjectURL(r.strip.blob));
    }
    return mf;
  }

  if (kind === 'page') {
    const path = `${prefix}${key}.html`;
    await backend.upload(path, file, 'text/html', onProgress);
    return { path, kind, mime: 'text/html', name: file.name, size: file.size };
  }

  const path = `${prefix}${key}.${extOf(file.name, file.type)}`;
  await backend.upload(path, file, file.type || 'application/octet-stream', onProgress);
  return { path, kind: 'file', mime: file.type || 'application/octet-stream', name: file.name, size: file.size };
}

export interface Draft {
  base?: Item;
  title: string;
  body: string;
  why: string;
  url: string;
  tags: string[];
  category_id: string | null;
  favorite: boolean;
  keepMedia: MediaFile[];
  files: File[];
  preview: LinkPreview | null;
  /** preview 가 어떤 입력값으로 만들어졌는지 */
  previewFor: string;
  /** 링크를 상세에서 웹페이지로 바로 띄울지 */
  asPage: boolean;
}

export function emptyDraft(category_id: string | null = null): Draft {
  return { title: '', body: '', why: '', url: '', tags: [], category_id, favorite: false, keepMedia: [], files: [], preview: null, previewFor: '', asPage: false };
}

export function draftFromItem(item: Item): Draft {
  return {
    base: item,
    title: item.title,
    body: item.body,
    why: item.why,
    url: item.url,
    tags: item.tags,
    category_id: item.category_id,
    favorite: item.favorite,
    keepMedia: item.media,
    files: [],
    preview: item.url || item.embed ? { url: item.url, embed: item.embed, link: item.link, ratio: item.media.length ? null : item.ratio } : null,
    previewFor: item.url,
    asPage: item.type === 'page' && !item.media.some((m) => m.kind === 'page'),
  };
}

export function mediaPaths(m: MediaFile): string[] {
  return [m.path, m.thumb, m.strip].filter(Boolean) as string[];
}

/** 작성 내용 → 저장된 항목 */
export async function saveDraft(d: Draft, onStep?: (msg: string) => void): Promise<Item> {
  const id = d.base?.id ?? uid();
  const media: MediaFile[] = [...d.keepMedia];

  // 주소만 있고 미리보기가 아직이면 지금 만듭니다
  let preview = d.url ? d.preview : null;
  if (d.url && (!preview || d.previewFor !== d.url)) {
    onStep?.('링크 확인 중');
    preview = await previewLink(d.url);
  }

  // 이미지 주소를 담으면 사본을 받아 일반 이미지처럼 저장 (원본이 사라져도 남도록)
  const files = [...d.files];
  if (preview?.isImage && !files.length && !media.length) {
    onStep?.('이미지 받는 중');
    const f = await fetchRemoteImage(preview.url);
    if (f) files.push(f);
  }

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const head = files.length > 1 ? `올리는 중 ${i + 1}/${files.length}` : '올리는 중';
    onStep?.(head);
    let last = -1;
    media.push(
      await uploadFile(id, f, (p) => {
        const pct = Math.round(p * 100);
        if (f.size > 400_000 && pct !== last && (pct - last >= 2 || pct === 100)) {
          last = pct;
          onStep?.(`${head} ${pct}% · ${(f.size / 1024 / 1024).toFixed(1)}MB`);
        }
      }),
    );
  }

  // HTML 페이지가 있으면 맨 앞에 (상세에서 페이지가 먼저 보이게)
  media.sort((a, b) => Number(b.kind === 'page') - Number(a.kind === 'page'));
  const first = media[0];
  // 카드 표지로 쓸 파일: 썸네일이 있거나 이미지인 첫 파일 (페이지 + 대표 이미지를 함께 올린 경우 그 이미지)
  const visual = media.find((m) => m.thumb || m.kind === 'image');
  const embed = preview?.embed ?? null;
  const link = preview?.link ?? null;
  const webPage = d.asPage && !!d.url && !embed && !preview?.isImage && !first;
  const type: Item['type'] = embed ? 'embed' : first ? first.kind : webPage ? 'page' : d.url ? 'link' : 'note';
  // 사본을 못 받은 이미지 주소는 원본 주소로 미리보기 (링크 카드)
  const cover = visual?.thumb ?? (visual?.kind === 'image' ? visual.path : null) ?? embed?.thumb ?? link?.image ?? null;
  const ratio = visual?.w && visual?.h ? visual.w / visual.h : first?.kind === 'page' ? null : (preview?.ratio ?? null);
  const now = nowIso();

  const item: Item = {
    id,
    category_id: d.category_id,
    type,
    title: d.title.trim(),
    body: d.body.trim(),
    url: (preview?.url || d.url).trim(),
    why: d.why.trim(),
    tags: [...new Set(d.tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean))],
    media,
    embed,
    link,
    cover,
    ratio,
    colors: visual?.colors ?? d.base?.colors ?? [],
    favorite: d.favorite,
    status: d.base?.status ?? 'new',
    markers: d.base?.markers ?? [],
    created_at: d.base?.created_at ?? now,
    updated_at: now,
  };
  onStep?.('저장 중');
  await backend.saveItem(item);

  if (d.base) {
    const removed = d.base.media.filter((m) => !media.some((k) => k.path === m.path));
    if (removed.length) await backend.remove(removed.flatMap(mediaPaths));
  }
  return item;
}

/** 붙여넣은 글 → 작성 내용 (주소·임베드 코드·메모 자동 구분) */
export function draftFromText(text: string, category_id: string | null): Draft {
  const d = emptyDraft(category_id);
  const t = text.trim();
  if (/<iframe\b/i.test(t)) {
    d.url = t;
    return d;
  }
  const { url, rest } = splitUrl(t);
  if (url) {
    d.url = url;
    if (rest && rest.length <= 120) d.title = rest;
    else d.body = rest;
    return d;
  }
  d.body = t;
  return d;
}

function prettyUrl(u: string): string {
  try {
    const x = new URL(u);
    const path = decodeURIComponent(x.pathname).replace(/\/$/, '');
    return (x.hostname.replace(/^www\./, '') + (path.length > 1 ? path : '')).slice(0, 80);
  } catch {
    return '';
  }
}

export function titleOf(item: Item): string {
  return item.title || item.link?.title || (item.media[0] ? baseName(item.media[0].name) : '') || item.body.split('\n')[0].slice(0, 80) || (item.url ? prettyUrl(item.url) : '') || '제목 없음';
}

/** 카드에 쓸 이미지: 저장된 표지, 없으면 이미지 주소 자체 (예전에 링크로 담긴 이미지 주소도 보이게) */
export function coverOf(item: Item): string | null {
  return item.cover || (item.type === 'link' && looksLikeImageUrl(item.url) ? item.url : null);
}
