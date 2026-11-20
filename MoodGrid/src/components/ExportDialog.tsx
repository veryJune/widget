// 내려받기 창: 범위(전체 · 선택 · 현재 보기)와 담을 것을 고르면 .zip 으로 한 번에
import { useMemo, useState } from 'react';
import { useStore, viewOptsOf } from '../store';
import { entriesOf, summarize, type ExportOptions } from '../lib/exporter';
import { buildView, isFiltering, liveSorted } from '../lib/order';
import { Button, Modal } from './ui';

export function ExportDialog() {
  const d = useStore((s) => s.exportDialog);
  if (!d) return null;
  return <Inner initial={d.scope} />;
}

function Check({ checked, onChange, disabled, label, hint }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; hint?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 ${disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-raise'}`}>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--mark)]" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-mute">{hint}</span>}
      </span>
    </label>
  );
}

function Inner({ initial }: { initial: 'all' | 'selection' | 'view' }) {
  const items = useStore((s) => s.items);
  const selection = useStore((s) => s.selection);
  const state = useStore();
  const act = useStore.getState;
  const filtering = isFiltering({ minRating: state.filter, query: state.query, color: state.colorFilter, kinds: state.kinds });

  const ordered = useMemo(() => liveSorted(items), [items]);
  const entries = useMemo(
    () => ({
      all: entriesOf(ordered, null),
      selection: entriesOf(ordered, new Set(selection)),
      view: entriesOf(ordered, new Set(buildView(items, viewOptsOf(state)).filter((i) => i.type !== 'divider').map((i) => i.id))),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordered, selection, items, state.filter, state.query, state.colorFilter, state.kinds, state.projects, state.currentId],
  );

  const [scope, setScope] = useState(initial === 'selection' && selection.size === 0 ? 'all' : initial === 'view' && !filtering ? 'all' : initial);
  const [opts, setOpts] = useState<ExportOptions>({ images: true, memos: true, links: true, videos: false });
  const sum = summarize(entries[scope]);
  const nothing = sum.total === 0 || (!(opts.images && sum.images) && !(opts.memos && sum.memos) && !(opts.links && sum.links) && !(opts.videos && sum.videoFiles));

  const scopes: { v: 'all' | 'selection' | 'view'; label: string; n: number; off: boolean }[] = [
    { v: 'all', label: '프로젝트 전체', n: entries.all.length, off: false },
    { v: 'selection', label: '선택한 항목', n: entries.selection.length, off: selection.size === 0 },
    { v: 'view', label: '지금 보이는 것 (필터 적용)', n: entries.view.length, off: !filtering },
  ];

  return (
    <Modal
      open
      onClose={() => act().closeExport()}
      title="내려받기"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={() => act().closeExport()}>
            닫기
          </Button>
          <Button variant="primary" disabled={nothing} onClick={() => void act().runExport(scope, opts)} data-autofocus>
            .zip 내려받기
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">범위</h3>
          <div className="grid gap-2" role="radiogroup" aria-label="내려받을 범위">
            {scopes.map((s) => (
              <label key={s.v} className={`flex items-center gap-3 rounded-lg border p-3 ${scope === s.v ? 'border-mark bg-mark/10' : 'border-line'} ${s.off ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-raise'}`}>
                <input type="radio" name="scope" className="h-4 w-4 accent-[var(--mark)]" checked={scope === s.v} disabled={s.off} onChange={() => setScope(s.v)} />
                <span className="flex-1 text-[14px] font-semibold">{s.label}</span>
                <span className="num text-[13px] text-mute">{s.n}개</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">담을 것</h3>
          <div className="grid gap-2">
            <Check checked={opts.images} disabled={sum.images === 0} onChange={(v) => setOpts({ ...opts, images: v })} label={`이미지 ${sum.images}장`} hint="올린 이미지와 캡처한 장면 (images/ 폴더, 번호_이름.webp · 타임코드 포함)" />
            <Check checked={opts.memos} disabled={sum.memos === 0} onChange={(v) => setOpts({ ...opts, memos: v })} label={`메모 ${sum.memos}개`} hint="메모 카드를 .txt 파일로 (memos/ 폴더)" />
            <Check checked={opts.links} disabled={sum.links === 0} onChange={(v) => setOpts({ ...opts, links: v })} label={`링크 · 영상 · 임베드 목록 ${sum.links}개`} hint="주소 · 제목 · 시작 시간 · 별점 · 메모를 links.csv 로 (엑셀에서 열림)" />
            <Check checked={opts.videos} disabled={sum.videoFiles === 0} onChange={(v) => setOpts({ ...opts, videos: v })} label={`영상 파일 ${sum.videoFiles}개 (직접 파일 주소만)`} hint="그 서버가 내려받기를 허용할 때만 받아져요. 용량이 클 수 있어요 (한 파일 150MB · 전체 400MB 까지). 못 받은 것은 README.txt 에 이유와 함께 남습니다." />
          </div>
        </section>

        <p className="rounded-lg bg-raise p-3 text-[12.5px] leading-relaxed text-mute">
          보드 전체를 섹션별로 정리한 <b className="text-ink">board.md</b> 와 모든 정보가 담긴 <b className="text-ink">index.json</b>, 요약 <b className="text-ink">README.txt</b> 도 함께 들어갑니다. YouTube · Vimeo 같은 스트리밍 영상과 임베드는 파일을 받을 수 없어 목록(주소)으로 남겨요. 다시 불러오기(복원)가 필요하면 메뉴의 <b className="text-ink">백업</b> 을 쓰세요.
        </p>
      </div>
    </Modal>
  );
}
