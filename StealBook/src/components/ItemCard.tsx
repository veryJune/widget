// 갤러리 카드 하나 — 이미지가 주인공, 정보는 필요할 때만
import { memo, useRef, useState } from 'react';
import { FileText, Link2, Play, Images } from 'lucide-react';
import type { Item } from '../lib/types';
import { useUrl } from '../lib/urls';
import { domainOf, fmtBytes, fmtTime } from '../lib/util';
import { PROVIDER_LABEL } from '../lib/embed';
import { coverOf, titleOf } from '../lib/capture';
import { OkMark } from './Scribble';
import { useStore } from '../store';
import { useHover } from '../hooks/useMedia';
import { SelectDot, useItemPress, useSelecting } from './Selection';

export const clampRatio = (r: number) => Math.min(2.6, Math.max(0.42, r));

export function noteHeight(item: Item, colW: number): number {
  const text = (item.body || item.why || '').slice(0, 600);
  const perLine = Math.max(8, colW / 10.5);
  const lines = Math.min(12, text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0));
  return 36 + lines * 22 + (item.title ? 26 : 0);
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`num pointer-events-none absolute rounded-[4px] bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm ${className}`}>{children}</span>;
}

function Scrub({ item, x }: { item: Item; x: number }) {
  const m = item.media[0];
  const url = useUrl(m.strip);
  if (!url || !m.stripFrames) return null;
  const n = m.stripFrames;
  const idx = Math.min(n - 1, Math.floor(x * n));
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: `url(${url})`, backgroundSize: `${n * 100}% 100%`, backgroundPosition: `${(idx / (n - 1)) * 100}% 0` }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/40">
        <div className="h-full bg-mark" style={{ width: `${x * 100}%` }} />
      </div>
    </>
  );
}

function CardInner({ item, fill, fresh, selecting }: { item: Item; fill: boolean; fresh?: boolean; selecting?: boolean }) {
  const coverPath = coverOf(item);
  const cover = useUrl(coverPath);
  const [broken, setBroken] = useState(false);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const hover = useHover();
  const toggleFav = useStore((s) => s.updateItem);
  const ref = useRef<HTMLDivElement>(null);
  const m = item.media[0];
  const ratio = fill ? 1 : item.ratio ? clampRatio(item.ratio) : null;
  const title = titleOf(item);
  const hasCover = !!coverPath && !broken;

  const onMove = (e: React.PointerEvent) => {
    if (!hover || !m?.strip || e.pointerType !== 'mouse') return;
    const r = ref.current!.getBoundingClientRect();
    setScrubX(Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  // 글(메모) 카드
  if (!hasCover && (item.type === 'note' || item.type === 'link' || item.type === 'embed')) {
    const isNote = item.type === 'note';
    return (
      <div ref={ref} className={`relative flex flex-col bg-panel p-4 transition-[padding] ${selecting ? 'pt-10' : ''} ${fill ? 'aspect-square' : ''}`}>
        {!isNote && (
          <span className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-mute">
            {item.embed ? <Play size={12} /> : <Link2 size={12} />}
            {item.embed ? PROVIDER_LABEL[item.embed.provider] : domainOf(item.url)}
          </span>
        )}
        {item.title && <p className="mb-1.5 line-clamp-2 text-[15px] font-bold leading-snug">{item.title}</p>}
        {(item.body || (!item.title && !isNote)) && (
          <p className={`note-text text-[14px] leading-[22px] text-ink/85 ${fill ? 'line-clamp-6' : 'line-clamp-[12]'}`}>{item.body || title}</p>
        )}
        <OkMark on={item.favorite} className="absolute right-2 top-2" />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-panel"
      style={{ aspectRatio: ratio ? String(ratio) : item.type === 'file' ? '4 / 3' : '4 / 5' }}
      onPointerMove={onMove}
      onPointerLeave={() => setScrubX(null)}
    >
      {hasCover && cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setBroken(true)}
          className={`absolute inset-0 h-full w-full object-cover ${fresh ? 'fade-in' : ''}`}
        />
      ) : hasCover ? (
        <div className="shimmer absolute inset-0" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-start justify-end gap-1 p-4 text-mute">
          <FileText size={22} />
          <span className="line-clamp-2 text-[13px] font-semibold text-ink">{title}</span>
          {m && <span className="num text-[12px]">{fmtBytes(m.size)}</span>}
        </div>
      )}

      {scrubX != null && <Scrub item={item} x={scrubX} />}

      {item.type === 'video' && m?.duration ? <Badge className="bottom-2 right-2">{fmtTime(scrubX != null ? scrubX * m.duration : m.duration)}</Badge> : null}
      {item.type === 'embed' && item.embed && (
        <Badge className="bottom-2 left-2 inline-flex items-center gap-1">
          <Play size={10} fill="currentColor" /> {PROVIDER_LABEL[item.embed.provider]}
        </Badge>
      )}
      {item.type === 'link' && <Badge className="bottom-2 left-2 max-w-[80%] truncate">{item.link?.site || domainOf(item.url)}</Badge>}
      {item.media.length > 1 && (
        <Badge className="left-2 top-2 inline-flex items-center gap-1">
          <Images size={11} /> {item.media.length}
        </Badge>
      )}

      {/* 마우스를 올렸을 때만 제목 */}
      {hover && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-2.5 pt-10 opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-1 text-[13px] font-semibold text-white">{title}</p>
          {item.why && <p className="line-clamp-1 text-[12px] text-white/75">{item.why}</p>}
        </div>
      )}

      <OkMark on={item.favorite} className="absolute right-2 top-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      {hover && !item.favorite && (
        <button
          type="button"
          aria-label="즐겨찾기"
          title="즐겨찾기"
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(item.id, { favorite: true });
          }}
          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
        >
          <span className="block h-3.5 w-3.5 rounded-full border-[1.5px] border-white" />
        </button>
      )}
    </div>
  );
}

export const ItemCard = memo(function ItemCard({ item, fill = false, fresh = false }: { item: Item; fill?: boolean; fresh?: boolean }) {
  const hover = useHover();
  const press = useItemPress(item.id);
  const selecting = useSelecting();
  const on = useStore((s) => s.selected.includes(item.id));
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={titleOf(item)}
      aria-pressed={selecting ? on : undefined}
      draggable={hover}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-stealbook-item', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      {...press}
      className={`group relative cursor-pointer select-none overflow-hidden rounded-md outline-offset-2 [-webkit-touch-callout:none] ${fresh ? 'drop-in' : ''}`}
    >
      <CardInner item={item} fill={fill} fresh={fresh} selecting={selecting} />
      {on && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-md bg-mark/10 ring-[3px] ring-inset ring-mark" />}
      <SelectDot on={on} show={selecting} />
    </article>
  );
});
