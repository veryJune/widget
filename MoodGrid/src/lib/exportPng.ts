// 지금 보이는 보드 그대로 한 장의 PNG 로 (DOM 의 카드 위치를 읽어 캔버스에 직접 그림 — 접힌 섹션은 제외, 해상도 한도 자동 조절)
import { useStore } from '../store';
import { loadBitmap } from './media';

const TEXT_BG: Record<string, [string, string]> = {
  white: ['#f7f7f7', '#141414'],
  yellow: ['#FFF3B0', '#4a3d00'],
  blue: ['#DCEBFA', '#10375c'],
  green: ['#DDEFDF', '#16401c'],
  dark: ['#0f0f0f', '#f0f0f0'],
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (ctx.measureText(test).width <= maxW || !line) {
        if (ctx.measureText(word).width > maxW) {
          for (const ch of word) {
            if (ctx.measureText(line + ch).width > maxW && line) {
              out.push(line);
              line = '';
            }
            line += ch;
          }
        } else line = test;
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

export async function exportBoardPng(title: string): Promise<void> {
  const grid = document.querySelector<HTMLElement>('.masonry');
  const st = useStore.getState();
  if (!grid) return;
  const els = [...grid.querySelectorAll<HTMLElement>('[data-card],[data-sec]')];
  if (!els.length) return st.toast('내보낼 내용이 없습니다.');
  const g = grid.getBoundingClientRect();
  const css = getComputedStyle(document.documentElement);
  const bg = css.getPropertyValue('--bg').trim() || '#161616';
  const ink = css.getPropertyValue('--ink').trim() || '#ececec';
  const line = css.getPropertyValue('--line').trim() || '#3a3a3a';
  const mute = css.getPropertyValue('--mute').trim() || '#9d9d9d';
  const card = css.getPropertyValue('--card').trim() || '#232323';

  const pad = 40;
  const W = g.width + pad * 2;
  const H = Math.max(...els.map((e) => e.getBoundingClientRect().bottom)) - g.top + pad * 2;
  const scale = Math.max(0.25, Math.min(2, 16000 / H, 16000 / W, Math.sqrt(90_000_000 / (W * H))));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return st.toast('이미지를 만들 수 없는 환경입니다.', { kind: 'error' });
  ctx.scale(scale, scale);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';

  st.toast('이미지 만드는 중…');
  const items = new Map(st.items.map((i) => [i.id, i]));
  const font = '"SUIT", system-ui, sans-serif';

  for (const el of els) {
    const r = (el.querySelector<HTMLElement>('.card') ?? el).getBoundingClientRect();
    const x = r.left - g.left + pad;
    const y = r.top - g.top + pad;
    if (el.dataset.sec) {
      const it = items.get(el.dataset.sec);
      const cy = el.getBoundingClientRect().top - g.top + pad + el.getBoundingClientRect().height / 2;
      ctx.font = `700 15px ${font}`;
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      const label = it?.content ?? '';
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, pad, cy);
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad + tw + 16, cy);
      ctx.lineTo(W - pad, cy);
      ctx.stroke();
      continue;
    }
    const it = items.get(el.dataset.id as string);
    if (!it) continue;
    ctx.save();
    roundRect(ctx, x, y, r.width, r.height, 16);
    ctx.clip();
    if (it.type === 'image') {
      const url = st.urls[it.path ?? ''] ?? st.urls[it.thumb ?? ''];
      const bmp = await loadBitmap(url);
      if (bmp) {
        const k = Math.max(r.width / bmp.width, r.height / bmp.height);
        const dw = bmp.width * k;
        const dh = bmp.height * k;
        ctx.drawImage(bmp, x + (r.width - dw) / 2, y + (r.height - dh) / 2, dw, dh);
        bmp.close();
      } else {
        ctx.fillStyle = card;
        ctx.fillRect(x, y, r.width, r.height);
      }
    } else if (it.type === 'text') {
      const [b, f] = TEXT_BG[it.color] ?? TEXT_BG.white;
      ctx.fillStyle = b;
      ctx.fillRect(x, y, r.width, r.height);
      const size = it.content.length < 30 ? 24 : it.content.length < 140 ? 17.6 : 15.2;
      ctx.font = `500 ${size}px ${font}`;
      ctx.fillStyle = f;
      ctx.textAlign = 'center';
      const lines = wrapLines(ctx, it.content, r.width - 48);
      const lh = size * 1.4;
      lines.forEach((l, i) => ctx.fillText(l, x + r.width / 2, y + r.height / 2 - ((lines.length - 1) * lh) / 2 + i * lh));
    } else {
      ctx.fillStyle = card;
      ctx.fillRect(x, y, r.width, r.height);
      ctx.textAlign = 'left';
      ctx.font = `700 14px ${font}`;
      ctx.fillStyle = ink;
      const lines = wrapLines(ctx, it.title || it.content, r.width - 32).slice(0, 2);
      lines.forEach((l, i) => ctx.fillText(l, x + 16, y + 24 + i * 19));
      ctx.font = `400 12px ${font}`;
      ctx.fillStyle = mute;
      ctx.fillText(it.content.length > 60 ? it.content.slice(0, 60) + '…' : it.content, x + 16, y + 24 + lines.length * 19 + 4);
    }
    ctx.restore();
    if (it.type !== 'image') {
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      roundRect(ctx, x + 0.5, y + 0.5, r.width - 1, r.height - 1, 16);
      ctx.stroke();
    }
  }

  await new Promise<void>((resolve) =>
    canvas.toBlob((blob) => {
      if (!blob) {
        st.toast('이미지를 만들지 못했습니다.', { kind: 'error' });
        return resolve();
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${title.replace(/[\\/:*?"<>|]+/g, '_') || 'moodgrid'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      st.toast(`PNG 를 내려받았습니다. (${canvas.width}×${canvas.height})`);
      resolve();
    }, 'image/png'),
  );
}
