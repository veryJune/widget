// 한 장짜리 이미지 만들기 공통 도구 (무드보드 · 영상 스틸 시트)
// - 그림을 '안전하게' 불러오기: 다른 사이트 그림은 서버를 거쳐 받아서 캔버스가 오염되지 않게
// - 글 줄바꿈, 내려받기, 의존성 없는 PDF 만들기
import { fetchRemoteImage } from './capture';
import { isExternal, resolveUrls } from './urls';
import type { Item } from './types';

/** 저장소 경로나 주소 → 캔버스에 그릴 수 있는 그림 (실패하면 null) */
export async function loadBitmap(src: string | null | undefined): Promise<ImageBitmap | null> {
  if (!src) return null;
  try {
    let url = src;
    if (!isExternal(src)) {
      url = (await resolveUrls([src]))[src];
      if (!url) return null;
    }
    if (/^https?:/.test(url) && !url.startsWith(location.origin) && !isStorage(url)) {
      // 다른 사이트 그림: 서버를 거쳐 받기 → 안 되면 직접 시도
      const f = await fetchRemoteImage(url);
      if (f) return await createImageBitmap(f);
    }
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    return await createImageBitmap(await r.blob());
  } catch {
    return null;
  }
}

const isStorage = (u: string) => /\.supabase\.co\/storage\//.test(u);

/** 항목을 대표하는 그림 (원본이 크면 원본, 아니면 표지) */
export function pictureOf(i: Item, big = true): string | null {
  const m = i.media[0];
  if (m?.kind === 'image') return big ? m.path : m.thumb || m.path;
  if (m?.kind === 'video') return m.thumb || null;
  if (i.cover) return i.cover;
  if (i.type === 'link' && /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(i.url)) return i.url;
  return null;
}

/** 글을 폭에 맞게 줄바꿈 (한글은 글자 단위로도 끊음) */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      const next = line + ch;
      if (ctx.measureText(next).width > maxW && line) {
        out.push(line);
        line = ch.trimStart();
        if (out.length >= maxLines) break;
      } else line = next;
    }
    if (out.length >= maxLines) break;
    out.push(line);
    if (out.length >= maxLines) break;
  }
  if (out.length >= maxLines) {
    const last = out[maxLines - 1];
    out.length = maxLines;
    if (text.length > out.join('').length) out[maxLines - 1] = last.replace(/.{0,1}$/, '…');
  }
  return out;
}

/** 그림을 칸에 꽉 채우기 (넘치는 부분은 잘라냄) */
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r;
  const sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

export const FONT = "'SUIT', system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const canvasBlob = (c: HTMLCanvasElement, type = 'image/png', q = 0.92) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지를 만들지 못했습니다.'))), type, q));

/** 캔버스 → 한 쪽짜리 PDF (JPEG 한 장을 그대로 넣음, 외부 라이브러리 없음) */
export async function canvasToPdf(c: HTMLCanvasElement): Promise<Blob> {
  const jpeg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.9)).arrayBuffer());
  const pw = Math.round(c.width * 0.75); // 96dpi 픽셀 → 72dpi 포인트
  const ph = Math.round(c.height * 0.75);
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array | string) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(u);
    len += u.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = len;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = len;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push('\nendstream\nendobj\n');
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let n = 1; n <= 5; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};
