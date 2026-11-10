// 갤러리: 메이슨리(벽돌) · 균일 그리드 · 목록 보기
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppWindow, Check, ClipboardPaste, FileText, Image as ImageIcon, Link2, Play, Video } from 'lucide-react';
import type { Item } from '../lib/types';
import { useStore, type Pending } from '../store';
import { useCompact, useElementWidth } from '../hooks/useMedia';
import { ItemCard, clampRatio, noteHeight } from './ItemCard';
import { useUrl } from '../lib/urls';
import { domainOf, fmtDate, fmtTime } from '../lib/util';
import { coverOf, titleOf } from '../lib/capture';
import { OkMark } from './Scribble';
import { pathLabel } from '../lib/tree';
import { Button, Swatch } from './ui';
import { useItemPress, useSelecting, visibleOrder } from './Selection';

const PAGE = 90;
const COL_TARGET = [190, 250, 330];

function isFresh(i: Item) {
  return Date.now() - Date.parse(i.created_at) < 5000;
}

function PendingCard({ p }: { p: Pending }) {
  return (
    <div className="relative overflow-hidden rounded-md bg-panel" style={{ aspectRatio: '4 / 5' }}>
      {p.preview ? <img src={p.preview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" /> : <div className="shimmer absolute inset-0" />}
      <span className="absolute bottom-2 left-2 rounded-[4px] bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">{p.label}</span>
    </div>
  );
}

function useInfinite(total: number) {
  const [limit, setLimit] = useState(PAGE);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '1400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [total]);
  return { limit, sentinel: <div ref={ref} aria-hidden className="h-px" /> };
}

function Masonry({ items, pending }: { items: Item[]; pending: Pending[] }) {
  const density = useStore((s) => s.density);
  const compact = useCompact();
  const [setRef, width] = useElementWidth<HTMLDivElement>();
  const gap = compact ? 6 : 8;
  const cols = compact ? (density === 2 ? 3 : density === 0 ? 1 : 2) : Math.max(2, Math.floor((width + gap) / (COL_TARGET[density] + gap)));
  const colW = width ? (width - gap * (cols - 1)) / cols : 240;
  const { limit, sentinel } = useInfinite(items.length);

  const columns = useMemo(() => {
    const heights = Array(cols).fill(0) as number[];
    const out: (Item | Pending)[][] = Array.from({ length: cols }, () => []);
    const all: (Item | Pending)[] = [...pending, ...items.slice(0, limit)];
    for (const it of all) {
      let h: number;
      if ('label' in it) h = colW * 1.25;
      else if (!coverOf(it) && (it.type === 'note' || it.type === 'link' || it.type === 'embed' || it.type === 'page')) h = noteHeight(it, colW);
      else h = it.ratio ? colW / clampRatio(it.ratio) : colW * (it.type === 'file' ? 0.75 : 1.25);
      const idx = heights.indexOf(Math.min(...heights));
      out[idx].push(it);
      heights[idx] += h + gap;
    }
    return out;
  }, [items, pending, cols, colW, gap, limit]);

  return (
    <div ref={setRef}>
      <div className="flex items-start" style={{ gap }}>
        {columns.map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
            {col.map((it) => ('label' in it ? <PendingCard key={it.id} p={it} /> : <ItemCard key={it.id} item={it} fresh={isFresh(it)} />))}
          </div>
        ))}
      </div>
      {sentinel}
    </div>
  );
}

function Grid({ items, pending }: { items: Item[]; pending: Pending[] }) {
  const density = useStore((s) => s.density);
  const compact = useCompact();
  const { limit, sentinel } = useInfinite(items.length);
  const style = compact
    ? { gridTemplateColumns: `repeat(${density === 2 ? 4 : density === 0 ? 2 : 3}, minmax(0, 1fr))`, gap: 4 }
    : { gridTemplateColumns: `repeat(auto-fill, minmax(${COL_TARGET[density] - 30}px, 1fr))`, gap: 8 };
  return (
    <>
      <div className="grid" style={style}>
        {pending.map((p) => (
          <div key={p.id} className="aspect-square overflow-hidden rounded-md">
            <PendingCard p={p} />
          </div>
        ))}
        {items.slice(0, limit).map((it) => (
          <ItemCard key={it.id} item={it} fill fresh={isFresh(it)} />
        ))}
      </div>
      {sentinel}
    </>
  );
}

const TYPE_ICON = { note: FileText, image: ImageIcon, video: Video, link: Link2, embed: Play, file: FileText, page: AppWindow };

function Row({ item }: { item: Item }) {
  const press = useItemPress(item.id);
  const selecting = useSelecting();
  const on = useStore((s) => s.selected.includes(item.id));
  const categories = useStore((s) => s.categories);
  const cat = categories.find((c) => c.id === item.category_id);
  const cover = useUrl(coverOf(item));
  const [broken, setBroken] = useState(false);
  const Icon = TYPE_ICON[item.type];
  const sub = item.why || item.link?.site || (item.url ? domainOf(item.url) : '') || item.body.split('\n')[0];
  return (
    <button
      type="button"
      {...press}
      aria-pressed={selecting ? on : undefined}
      className={`flex w-full select-none items-center gap-3 border-b border-line/70 px-2 py-2 text-left transition [-webkit-touch-callout:none] md:gap-4 md:px-3 ${on ? 'bg-mark/10' : 'hover:bg-panel'}`}
    >
      {selecting && (
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-mark bg-mark text-bg' : 'border-faint'}`}>
          {on && <Check size={12} strokeWidth={3} />}
        </span>
      )}
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[5px] bg-panel md:h-14 md:w-14">
        {cover && !broken ? (
          <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <Icon size={18} className="absolute inset-0 m-auto text-mute" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{titleOf(item)}</span>
          <OkMark on={item.favorite} size={16} />
        </span>
        {sub && <span className="block truncate text-[13px] text-mute">{sub}</span>}
      </span>
      <span className="hidden w-28 shrink-0 items-center gap-1.5 text-[13px] text-mute lg:flex">
        <Icon size={14} />
        {item.type === 'video' && item.media[0]?.duration ? <span className="num">{fmtTime(item.media[0].duration)}</span> : null}
      </span>
      <span className="hidden w-36 shrink-0 items-center gap-2 truncate text-[13px] text-mute md:flex">
        {cat ? (
          <>
            <Swatch color={cat.color} size={8} /> <span className="truncate" title={pathLabel(categories, cat.id)}>{cat.name}</span>
          </>
        ) : (
          '미분류'
        )}
      </span>
      <span className="hidden w-40 shrink-0 truncate text-[13px] text-faint xl:block">{item.tags.map((t) => `#${t}`).join(' ')}</span>
      <span className="num w-20 shrink-0 text-right text-[12px] text-faint md:w-24 md:text-[13px]">{fmtDate(item.created_at)}</span>
    </button>
  );
}

function List({ items }: { items: Item[] }) {
  const { limit, sentinel } = useInfinite(items.length);
  return (
    <div className="border-t border-line/70">
      {items.slice(0, limit).map((it) => (
        <Row key={it.id} item={it} />
      ))}
      {sentinel}
    </div>
  );
}

function Empty({ filtered }: { filtered: boolean }) {
  const compact = useCompact();
  const { clearFilters, openComposer } = useStore();
  if (filtered) {
    return (
      <div className="flex flex-col items-start gap-3 py-16">
        <p className="text-[17px] font-bold">조건에 맞는 항목이 없습니다</p>
        <p className="text-mute">검색어나 필터를 바꾸거나 지워 보세요.</p>
        <Button onClick={clearFilters}>필터 지우기</Button>
      </div>
    );
  }
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-16">
      <p className="text-[22px] font-extrabold tracking-tight">아직 담은 게 없습니다</p>
      {compact ? (
        <p className="text-mute">
          아래 + 버튼으로 사진·영상·링크·메모를 담거나, 유튜브·인스타그램에서 <b className="text-ink">공유 → Steal Book</b>을 눌러 보세요.
        </p>
      ) : (
        <p className="text-mute">
          보고 있던 이미지·링크·글을 복사해서 이 화면 어디서든 <b className="text-ink">Ctrl+V</b>로 붙여넣으면 바로 담깁니다. 파일은 끌어다 놓아도 됩니다.
        </p>
      )}
      <Button variant="primary" onClick={() => openComposer()}>
        <ClipboardPaste size={16} /> 첫 영감 담기
      </Button>
    </div>
  );
}

export function Gallery({ items, filtered }: { items: Item[]; filtered: boolean }) {
  const view = useStore((s) => s.view);
  visibleOrder.current = items.map((i) => i.id);
  const pending = useStore((s) => s.pending);
  if (!items.length && !pending.length) return <Empty filtered={filtered} />;
  if (view === 'list') return <List items={items} />;
  if (view === 'grid') return <Grid items={items} pending={pending} />;
  return <Masonry items={items} pending={pending} />;
}
