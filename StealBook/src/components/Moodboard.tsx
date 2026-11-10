// 무드보드 내보내기: 고른 카드(없으면 지금 보이는 것)를 한 장짜리 PNG · PDF 로
// 클라이언트 시안 공유, 촬영 콘티 회의, 레퍼런스 정리용
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileDown, ImagePlus, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { useVisibleItems } from '../hooks/useVisible';
import { useCompact } from '../hooks/useMedia';
import { canvasBlob, canvasToPdf, download, drawCover, FONT, loadBitmap, pictureOf, stamp, wrapText } from '../lib/board';
import { emptyDraft, titleOf } from '../lib/capture';
import { sourceOf } from '../lib/query';
import type { Item } from '../lib/types';
import { Button, Modal, inputCls } from './ui';
import { useScopeLabel } from './Toolbar';

const MAX = 60;

type Layout = 'masonry' | 'grid';
type Bg = 'dark' | 'light' | 'white';
type Caption = 'none' | 'title' | 'source';
interface Opts {
  title: string;
  layout: Layout;
  cols: number;
  bg: Bg;
  caption: Caption;
  gap: 0 | 1 | 2;
  width: number;
}

const BG: Record<Bg, { bg: string; card: string; ink: string; faint: string }> = {
  dark: { bg: '#161616', card: '#242424', ink: '#ececec', faint: '#8a8a8a' },
  light: { bg: '#f3f3f1', card: '#ffffff', ink: '#141414', faint: '#8a8a86' },
  white: { bg: '#ffffff', card: '#f2f2f0', ink: '#141414', faint: '#8a8a86' },
};

interface Piece {
  item: Item;
  img: ImageBitmap | null;
}

/** 실제로 그리기 (미리보기·내보내기 공통) */
function render(pieces: Piece[], o: Opts): HTMLCanvasElement {
  const W = o.width;
  const u = W / 2400; // 기준 크기 대비 배율
  const pad = Math.round(96 * u);
  const gap = Math.round([8, 20, 40][o.gap] * u);
  const colW = (W - pad * 2 - gap * (o.cols - 1)) / o.cols;
  const capH = o.caption === 'none' ? 0 : Math.round((o.caption === 'source' ? 72 : 52) * u);
  const headH = o.title.trim() ? Math.round(150 * u) : 0;
  const theme = BG[o.bg];

  // 글 카드 크기 재기용
  const mctx = document.createElement('canvas').getContext('2d')!;
  const ip = Math.round(30 * u);
  const titleSize = Math.round(34 * u);
  const bodySize = Math.round(26 * u);
  const textCard = (it: Item) => {
    mctx.font = `700 ${titleSize}px ${FONT}`;
    const tl = wrapText(mctx, titleOf(it), colW - ip * 2, 3);
    mctx.font = `500 ${bodySize}px ${FONT}`;
    const body = it.body || it.why || it.link?.description || '';
    const bl = body ? wrapText(mctx, body, colW - ip * 2, 8) : [];
    return { tl, bl, h: ip * 2 + tl.length * titleSize * 1.3 + (bl.length ? Math.round(14 * u) + bl.length * bodySize * 1.45 : 0) };
  };

  // 칸 높이 계산
  const boxes = pieces.map((p) => {
    const text = p.img ? null : textCard(p.item);
    let h: number;
    if (o.layout === 'grid') h = colW;
    else if (p.img) h = colW * (p.img.height / p.img.width);
    else h = Math.max(colW * 0.4, text!.h); // 글 카드는 글 양만큼
    return { p, text, h: Math.min(h, colW * 2.4) };
  });
  const colsY = new Array(o.cols).fill(pad + headH);
  const placed = boxes.map((b) => {
    const c = colsY.indexOf(Math.min(...colsY));
    const x = pad + c * (colW + gap);
    const y = colsY[c];
    colsY[c] += b.h + capH + gap;
    return { ...b, x, y };
  });
  const H = Math.ceil(Math.max(...colsY) - gap + pad);

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = Math.max(H, pad * 2 + headH + 10);
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);

  if (headH) {
    ctx.fillStyle = theme.ink;
    ctx.font = `800 ${Math.round(64 * u)}px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(o.title.trim(), pad, pad + Math.round(70 * u));
    ctx.fillStyle = theme.faint;
    ctx.font = `500 ${Math.round(24 * u)}px ${FONT}`;
    ctx.fillText(`${pieces.length}개 · Steal Book`, pad, pad + Math.round(112 * u));
  }

  const r = Math.round(10 * u);
  for (const b of placed) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, colW, b.h, r);
    ctx.clip();
    if (b.p.img) {
      ctx.fillStyle = theme.card; // 투명 배경 그림(로고 등)도 보이게
      ctx.fillRect(b.x, b.y, colW, b.h);
      if (o.layout === 'grid' || b.h < colW * (b.p.img.height / b.p.img.width) - 1) drawCover(ctx, b.p.img, b.x, b.y, colW, b.h);
      else ctx.drawImage(b.p.img, b.x, b.y, colW, b.h);
    } else if (b.text) {
      // 그림이 없는 항목: 글 카드
      ctx.fillStyle = theme.card;
      ctx.fillRect(b.x, b.y, colW, b.h);
      ctx.textBaseline = 'top';
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${titleSize}px ${FONT}`;
      b.text.tl.forEach((t, k) => ctx.fillText(t, b.x + ip, b.y + ip + k * titleSize * 1.3));
      ctx.fillStyle = theme.faint;
      ctx.font = `500 ${bodySize}px ${FONT}`;
      const top = b.y + ip + b.text.tl.length * titleSize * 1.3 + Math.round(14 * u);
      b.text.bl.forEach((t, k) => {
        if (top + (k + 1) * bodySize * 1.45 <= b.y + b.h - ip / 2) ctx.fillText(t, b.x + ip, top + k * bodySize * 1.45);
      });
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    if (capH) {
      ctx.fillStyle = theme.ink;
      ctx.font = `600 ${Math.round(22 * u)}px ${FONT}`;
      const t = wrapText(ctx, titleOf(b.p.item), colW, 1)[0] || '';
      ctx.fillText(t, b.x, b.y + b.h + Math.round(32 * u));
      if (o.caption === 'source') {
        ctx.fillStyle = theme.faint;
        ctx.font = `500 ${Math.round(18 * u)}px ${FONT}`;
        ctx.fillText(sourceOf(b.p.item).label, b.x, b.y + b.h + Math.round(58 * u));
      }
    }
  }
  return cv;
}

export function Moodboard() {
  const { panel, set, items, selected, submitDraft, toast } = useStore();
  const visible = useVisibleItems();
  const compact = useCompact();
  const scopeLabel = useScopeLabel();
  const open = panel === 'moodboard';

  const chosen = useMemo(() => {
    if (!open) return [];
    const list = selected.length ? items.filter((i) => selected.includes(i.id)) : visible;
    return list.filter((i) => !i.deleted_at).slice(0, MAX);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const [o, setO] = useState<Opts>({ title: '', layout: 'masonry', cols: 4, bg: 'dark', caption: 'none', gap: 1, width: 2400 });
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [loadedN, setLoadedN] = useState(0);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 열릴 때: 제목 기본값 + 그림 불러오기
  useEffect(() => {
    if (!open) {
      setPieces(null);
      setPreview('');
      return;
    }
    setO((x) => ({ ...x, title: scopeLabel || '무드보드', cols: chosen.length <= 4 ? Math.max(2, chosen.length) : chosen.length <= 9 ? 3 : 4 }));
    let alive = true;
    setLoadedN(0);
    (async () => {
      const out: Piece[] = new Array(chosen.length);
      let n = 0;
      await Promise.all(
        chosen.map(async (item, k) => {
          out[k] = { item, img: await loadBitmap(pictureOf(item)) };
          if (alive) setLoadedN(++n);
        }),
      );
      if (alive) setPieces(out);
    })();
    return () => {
      alive = false;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 옵션이 바뀌면 다시 그리기 (미리보기는 작게)
  useEffect(() => {
    if (!pieces) return;
    const t = setTimeout(async () => {
      await document.fonts?.ready;
      const cv = render(pieces, { ...o, width: 1200 });
      canvasRef.current = cv;
      setPreview(cv.toDataURL('image/jpeg', 0.85));
    }, 120);
    return () => clearTimeout(t);
  }, [pieces, o]);

  const full = async () => {
    await document.fonts?.ready;
    return render(pieces!, o);
  };
  const name = () => `${(o.title.trim() || 'moodboard').replace(/[\\/:*?"<>|]+/g, '_')}-${stamp()}`;

  const exportPng = async () => {
    setBusy('png');
    try {
      download(await canvasBlob(await full()), `${name()}.png`);
    } finally {
      setBusy('');
    }
  };
  const exportPdf = async () => {
    setBusy('pdf');
    try {
      download(await canvasToPdf(await full()), `${name()}.pdf`);
    } finally {
      setBusy('');
    }
  };
  const saveAsItem = async () => {
    setBusy('item');
    try {
      const blob = await canvasBlob(await full());
      const d = emptyDraft(null);
      d.title = o.title.trim() || '무드보드';
      d.body = `${chosen.length}개 항목으로 만든 무드보드`;
      d.tags = ['무드보드'];
      d.files = [new File([blob], `${name()}.png`, { type: 'image/png' })];
      set({ panel: null });
      await submitDraft(d);
    } catch {
      toast('무드보드를 담지 못했습니다.', { kind: 'error' });
    } finally {
      setBusy('');
    }
  };

  const missing = pieces ? pieces.filter((p) => !p.img && pictureOf(p.item)).length : 0;
  const seg = (on: boolean) => `h-8 flex-1 whitespace-nowrap rounded-md px-2 text-[13px] font-semibold transition ${on ? 'bg-raise text-ink shadow-sm' : 'text-mute hover:text-ink'}`;

  return (
    <Modal open={open} onClose={() => set({ panel: null })} title="무드보드 만들기" width={1040} full={compact}>
      <div className={`flex min-h-0 ${compact ? 'flex-col' : 'h-[min(76dvh,720px)]'}`}>
        <div className={`scroll-thin grid min-h-0 flex-1 place-items-center overflow-auto bg-bg p-4 ${compact ? 'h-[46dvh]' : ''}`}>
          {!pieces ? (
            <p className="flex items-center gap-2 text-[14px] text-mute">
              <Loader2 size={16} className="animate-spin" /> 그림 불러오는 중 {loadedN}/{chosen.length}
            </p>
          ) : chosen.length === 0 ? (
            <p className="text-[14px] text-mute">담긴 항목이 없습니다.</p>
          ) : (
            preview && <img src={preview} alt="무드보드 미리보기" className="max-h-full max-w-full rounded-md shadow-lg" />
          )}
        </div>
        <div className={`scroll-thin shrink-0 space-y-4 p-5 ${compact ? '' : 'w-[300px] overflow-y-auto border-l border-line'}`}>
          <p className="text-[13px] text-mute">
            {selected.length ? `고른 ${chosen.length}개` : `지금 보이는 ${chosen.length}개`}
            {(selected.length || visible.length) > MAX && ` (최대 ${MAX}개)`}로 만듭니다.
            {missing > 0 && <span className="block text-faint">그림을 못 가져온 {missing}개는 글 카드로 들어갑니다.</span>}
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">제목 (비우면 없음)</span>
            <input value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} className={inputCls} />
          </label>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">배치</span>
            <div className="flex gap-1 rounded-lg bg-bg p-1">
              <button type="button" className={seg(o.layout === 'masonry')} onClick={() => setO({ ...o, layout: 'masonry' })}>
                벽돌 (원래 비율)
              </button>
              <button type="button" className={seg(o.layout === 'grid')} onClick={() => setO({ ...o, layout: 'grid' })}>
                정사각 격자
              </button>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">한 줄 개수 · {o.cols}</span>
            <input type="range" min={2} max={6} value={o.cols} onChange={(e) => setO({ ...o, cols: +e.target.value })} className="w-full accent-[var(--mark)]" aria-label="한 줄 개수" />
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">바탕</span>
            <div className="flex gap-1 rounded-lg bg-bg p-1">
              {(['dark', 'light', 'white'] as const).map((b) => (
                <button key={b} type="button" className={seg(o.bg === b)} onClick={() => setO({ ...o, bg: b })}>
                  {b === 'dark' ? '어둡게' : b === 'light' ? '종이' : '흰색'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">사이 간격</span>
            <div className="flex gap-1 rounded-lg bg-bg p-1">
              {(['좁게', '보통', '넓게'] as const).map((g, k) => (
                <button key={g} type="button" className={seg(o.gap === k)} onClick={() => setO({ ...o, gap: k as 0 | 1 | 2 })}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">아래 글씨</span>
            <div className="flex gap-1 rounded-lg bg-bg p-1">
              {(['none', 'title', 'source'] as const).map((c) => (
                <button key={c} type="button" className={seg(o.caption === c)} onClick={() => setO({ ...o, caption: c })}>
                  {c === 'none' ? '없음' : c === 'title' ? '제목' : '제목+출처'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-faint">크기</span>
            <div className="flex gap-1 rounded-lg bg-bg p-1">
              {[1600, 2400, 3600].map((w) => (
                <button key={w} type="button" className={seg(o.width === w)} onClick={() => setO({ ...o, width: w })}>
                  {w === 1600 ? '가볍게' : w === 2400 ? '보통' : '크게'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-faint">가로 {o.width}px</p>
          </div>
          <div className={`grid gap-2 border-t border-line pt-4 ${compact ? 'sticky bottom-0 -mx-5 bg-panel px-5 pb-[max(16px,env(safe-area-inset-bottom))]' : ''}`}>
            <Button variant="primary" disabled={!pieces || !chosen.length || !!busy} onClick={exportPng}>
              {busy === 'png' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PNG 내려받기
            </Button>
            <Button disabled={!pieces || !chosen.length || !!busy} onClick={exportPdf}>
              {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF 내려받기
            </Button>
            <Button disabled={!pieces || !chosen.length || !!busy} onClick={saveAsItem}>
              <ImagePlus size={15} /> Steal Book에 새 항목으로 담기
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
