// 브라우저 안에서 이미지·영상을 가볍게 만드는 곳 (서버 비용 0원)
//  - 이미지: 긴 변 2560px로 줄이고 WebP로 압축, 갤러리용 썸네일(가로 640px) 따로 생성
//  - 영상: 원본은 그대로 두고, 대표 프레임 썸네일 + 훑어보기용 프레임 스트립(12장) 생성
//  - 대표 색 추출 (색으로 찾기용)

export interface Encoded {
  blob: Blob;
  mime: string;
  ext: string;
}

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

type Drawable = ImageBitmap | HTMLImageElement | HTMLVideoElement;

function sizeOf(src: Drawable): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
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
      bk.r += d[i]; bk.g += d[i + 1]; bk.b += d[i + 2]; bk.n++;
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
    return []; // 외부 이미지 등 색을 읽을 수 없는 경우
  }
}

// ---------- 이미지 ----------

export interface ImageResult {
  main: Encoded;
  thumb: Encoded;
  w: number;
  h: number;
  colors: string[];
}

export async function processImage(file: File): Promise<ImageResult> {
  const src = await loadImage(file);
  const { w, h } = sizeOf(src);
  const animated = file.type === 'image/gif' || file.type === 'image/svg+xml';
  const smallEnough = file.size < 350_000 && Math.max(w, h) <= 2560;
  const main: Encoded =
    animated || smallEnough
      ? { blob: file, mime: file.type || 'image/jpeg', ext: (file.name.split('.').pop() || 'jpg').toLowerCase() }
      : await encodeCanvas(drawFit(src, 2560, 2560), 0.86);
  const thumbCanvas = drawFit(src, 640, 1600);
  const thumb = await encodeCanvas(thumbCanvas, 0.78);
  const colors = extractColors(thumbCanvas);
  if ('close' in src && typeof src.close === 'function') src.close();
  return { main, thumb, w, h, colors };
}

// ---------- 영상 ----------

function once(el: HTMLMediaElement, ok: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => done(new Error('영상을 읽는 데 시간이 너무 오래 걸립니다.')), ms);
    const onOk = () => done();
    const onErr = () => done(new Error('이 영상 형식은 브라우저에서 미리보기를 만들 수 없습니다.'));
    function done(err?: Error) {
      clearTimeout(t);
      el.removeEventListener(ok, onOk);
      el.removeEventListener('error', onErr);
      if (err) reject(err);
      else resolve();
    }
    el.addEventListener(ok, onOk);
    el.addEventListener('error', onErr);
  });
}

async function seek(v: HTMLVideoElement, t: number) {
  const p = once(v, 'seeked', 5000);
  v.currentTime = t;
  await p;
}

export interface VideoResult {
  w: number;
  h: number;
  duration: number;
  thumb?: Encoded;
  strip?: Encoded;
  frames?: number;
  colors: string[];
}

export async function processVideo(file: File): Promise<VideoResult> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  try {
    await once(v, 'loadeddata', 15000);
    const w = v.videoWidth;
    const h = v.videoHeight;
    const duration = isFinite(v.duration) ? v.duration : 0;
    if (!w || !h) return { w, h, duration, colors: [] };

    await seek(v, duration ? Math.min(duration * 0.1, 1.5) : 0);
    const posterCanvas = drawFit(v, 640, 1600);
    const thumb = await encodeCanvas(posterCanvas, 0.8);
    const colors = extractColors(posterCanvas);

    let strip: Encoded | undefined;
    let frames: number | undefined;
    if (duration > 1) {
      frames = duration < 4 ? 6 : 12;
      const fw = w >= h ? 240 : 160;
      const fh = Math.round((fw * h) / w);
      const c = document.createElement('canvas');
      c.width = fw * frames;
      c.height = fh;
      const ctx = c.getContext('2d')!;
      for (let i = 0; i < frames; i++) {
        await seek(v, (duration * (i + 0.5)) / frames);
        ctx.drawImage(v, i * fw, 0, fw, fh);
      }
      strip = await encodeCanvas(c, 0.7);
    }
    return { w, h, duration, thumb, strip, frames, colors };
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
  }
}

/** 재생 중인 영상의 현재 화면을 썸네일로 (상세 보기 '이 장면을 썸네일로') */
export async function captureFrame(v: HTMLVideoElement): Promise<{ thumb: Encoded; colors: string[] }> {
  const c = drawFit(v, 640, 1600);
  return { thumb: await encodeCanvas(c, 0.8), colors: extractColors(c) };
}

/** 외부 이미지 크기 알아내기 (링크 미리보기 카드 비율용) */
export function imageSize(url: string, ms = 6000): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), ms);
    img.onload = () => {
      clearTimeout(t);
      resolve(img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : null);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.referrerPolicy = 'no-referrer';
    img.src = url;
  });
}

export function fileKind(file: File): 'image' | 'video' | 'file' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}
