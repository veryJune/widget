// 브라우저 안에서 이미지를 가볍게 만드는 곳 (서버 비용 0원)
//  - 보기용 원본: 긴 변 2560px 이하 WebP (PNG 투명도 유지, GIF 는 움직임 보존을 위해 원본 그대로)
//  - 보드용 썸네일: 가로 960px 이하 WebP
//  - 대표 색 추출 (색상순 정렬용)

export interface Encoded {
  blob: Blob;
  mime: string;
  ext: string;
}

export interface ImageResult {
  main: Encoded;
  thumb: Encoded;
  w: number;
  h: number;
  colors: string[];
}

export const MAX_GIF_BYTES = 20 * 1024 * 1024;

let webpOk: boolean | null = null;
function canWebp(): boolean {
  if (webpOk == null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 2;
      webpOk = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpOk = false;
    }
  }
  return webpOk;
}

export function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Encoded> {
  const mime = canWebp() ? 'image/webp' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve({ blob: b, mime: b.type || mime, ext: (b.type || mime) === 'image/webp' ? 'webp' : 'jpg' }) : reject(new Error('이미지를 만들지 못했습니다.'))),
      mime,
      quality,
    );
  });
}

type Drawable = ImageBitmap | HTMLImageElement;

function sizeOf(src: Drawable): { w: number; h: number } {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

/** 가로 maxW, 세로 maxH 안에 들어가게 줄여서 그림 (키우지는 않음) */
export function drawFit(src: Drawable, maxW: number, maxH: number): HTMLCanvasElement {
  const { w, h } = sizeOf(src);
  const s = Math.min(1, maxW / w, maxH / h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

async function loadImage(file: Blob): Promise<Drawable> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
}

// ---------- 대표 색 ----------

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** 그림에서 많이 쓰인 색 최대 5개 (비슷한 색은 하나로) */
export function extractColors(canvas: HTMLCanvasElement, count = 5): string[] {
  try {
    const S = 48;
    const c = document.createElement('canvas');
    const s = Math.min(1, S / canvas.width, S / canvas.height);
    c.width = Math.max(1, Math.round(canvas.width * s));
    c.height = Math.max(1, Math.round(canvas.height * s));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      const bk = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      bk.r += d[i];
      bk.g += d[i + 1];
      bk.b += d[i + 2];
      bk.n++;
      buckets.set(key, bk);
    }
    const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
    const picked: [number, number, number][] = [];
    for (const bk of sorted) {
      const rgb: [number, number, number] = [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n];
      if (picked.every((p) => Math.hypot(p[0] - rgb[0], p[1] - rgb[1], p[2] - rgb[2]) > 48)) picked.push(rgb);
      if (picked.length >= count) break;
    }
    return picked.map((p) => toHex(...p));
  } catch {
    return [];
  }
}

// ---------- 이미지 ----------

export async function processImage(file: File): Promise<ImageResult> {
  const isGif = file.type === 'image/gif';
  if (isGif && file.size > MAX_GIF_BYTES) throw new Error('GIF 는 20MB 이하만 올릴 수 있습니다.');
  const src = await loadImage(file);
  const { w, h } = sizeOf(src);
  const smallEnough = file.size < 350_000 && Math.max(w, h) <= 2560 && /^image\/(webp|jpeg|png|avif)$/.test(file.type);
  const main: Encoded =
    isGif || smallEnough
      ? { blob: file, mime: file.type, ext: ({ 'image/gif': 'gif', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif' } as Record<string, string>)[file.type] }
      : await encodeCanvas(drawFit(src, 2560, 2560), 0.86);
  const thumbCanvas = drawFit(src, 960, 2000);
  const thumb = await encodeCanvas(thumbCanvas, 0.8);
  const colors = extractColors(thumbCanvas);
  if ('close' in src && typeof src.close === 'function') src.close();
  return { main, thumb, w, h, colors };
}

/** 이미지 주소(또는 data: 주소) → 파일. 다른 사이트 이미지는 서버(/api/unfurl)를 거쳐 받음 */
export async function fetchImageFile(url: string, token: string | null): Promise<File | null> {
  try {
    let blob: Blob | null = null;
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      blob = await (await fetch(url)).blob();
    } else {
      const r = await fetch(`/api/unfurl?mode=image&url=${encodeURIComponent(url)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
      if (r.ok) blob = await r.blob();
    }
    if (!blob || !blob.type.startsWith('image/')) return null;
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

/** 저장소 경로나 주소 → 캔버스에 그릴 수 있는 그림 (실패하면 null) */
export async function loadBitmap(src: string | null | undefined): Promise<ImageBitmap | null> {
  if (!src) return null;
  try {
    const r = await fetch(src, { mode: 'cors' });
    if (!r.ok) return null;
    return await createImageBitmap(await r.blob());
  } catch {
    return null;
  }
}
