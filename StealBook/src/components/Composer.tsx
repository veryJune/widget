// 담기 · 수정 창 — 게시글 쓰듯이: 파일, 링크/임베드, 제목, 메모, 왜 담았나, 카테고리, 태그
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Link2, Loader2, Play, Plus, Upload, X } from 'lucide-react';
import { useStore } from '../store';
import { previewLink, type Draft, type LinkPreview } from '../lib/capture';
import { parseEmbed, PROVIDER_LABEL } from '../lib/embed';
import type { MediaFile } from '../lib/types';
import { useUrl } from '../lib/urls';
import { fmtBytes, isUrl, splitUrl } from '../lib/util';
import { useAllTags } from '../hooks/useVisible';
import { useCompact } from '../hooks/useMedia';
import { Button, Field, Modal, inputCls } from './ui';
import { OkMark } from './Scribble';
import { CategoryPicker } from './CategoryPicker';

function NewFileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => (file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return (
    <Thumb onRemove={onRemove} label={file.name}>
      {file.type.startsWith('image/') ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : file.type.startsWith('video/') ? (
        <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <FileBox name={file.name} size={file.size} />
      )}
    </Thumb>
  );
}

function KeptThumb({ m, onRemove }: { m: MediaFile; onRemove: () => void }) {
  const url = useUrl(m.thumb || (m.kind === 'image' ? m.path : null));
  return (
    <Thumb onRemove={onRemove} label={m.name}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <FileBox name={m.name} size={m.size} />}
    </Thumb>
  );
}

function FileBox({ name, size }: { name: string; size: number }) {
  return (
    <div className="flex h-full w-full flex-col justify-end gap-0.5 bg-raise p-2 text-left">
      <FileText size={16} className="text-mute" />
      <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{name}</span>
      <span className="num text-[10px] text-faint">{fmtBytes(size)}</span>
    </div>
  );
}

function Thumb({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-raise" title={label}>
      {children}
      <button type="button" onClick={onRemove} aria-label={`${label} 빼기`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-white">
        <X size={13} />
      </button>
    </div>
  );
}

function PreviewCard({ p, loading }: { p: LinkPreview | null; loading: boolean }) {
  const [broken, setBroken] = useState(false);
  const img = broken ? undefined : p?.embed?.thumb || p?.link?.image;
  if (loading)
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-bg px-3 py-3 text-[13px] text-mute">
        <Loader2 size={14} className="animate-spin" /> 링크 확인 중
      </div>
    );
  if (!p) return null;
  return (
    <div className="mt-2 flex items-stretch gap-3 overflow-hidden rounded-lg border border-line bg-bg">
      {img ? <img src={img} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-[72px] w-[96px] shrink-0 object-cover" /> : null}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3">
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-mute">
          {p.embed ? <Play size={11} /> : <Link2 size={11} />}
          {p.embed ? `${PROVIDER_LABEL[p.embed.provider]} 임베드` : p.link?.site}
        </span>
        <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{p.link?.title || p.url}</span>
      </div>
    </div>
  );
}

export function Composer() {
  const { composer, set, submitDraft } = useStore();
  const compact = useCompact();
  const allTags = useAllTags();
  const [d, setD] = useState<Draft | null>(composer.draft);
  const [loading, setLoading] = useState(false);
  const [tagText, setTagText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => setD(composer.draft), [composer.draft]);

  // 링크가 바뀌면 잠시 뒤 미리보기
  const url = d?.url ?? '';
  useEffect(() => {
    if (!d) return;
    const v = url.trim();
    if (!v || v === d.previewFor) return;
    if (!isUrl(v) && !/<iframe\b/i.test(v)) return;
    const id = ++reqId.current;
    const quick = parseEmbed(v);
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const p = await previewLink(v);
        if (id === reqId.current) setD((x) => (x ? { ...x, preview: p, previewFor: v, title: x.title || '' } : x));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, quick ? 50 : 450);
    return () => clearTimeout(t);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!composer.open || !d) return null;
  const editing = !!d.base;
  const patch = (p: Partial<Draft>) => setD((x) => (x ? { ...x, ...p } : x));
  const close = () => set({ composer: { open: false, draft: null } });

  const addFiles = (list: FileList | File[]) => {
    const files = [...list];
    if (files.length) patch({ files: [...d.files, ...files] });
  };

  const addTag = (raw: string) => {
    const parts = raw.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);
    if (parts.length) patch({ tags: [...new Set([...d.tags, ...parts])] });
    setTagText('');
  };

  const canSave = !!(d.files.length || d.keepMedia.length || d.url.trim() || d.body.trim() || d.title.trim());
  const submit = () => {
    if (!canSave) return;
    const final = tagText.trim() ? { ...d, tags: [...new Set([...d.tags, ...tagText.split(/[,\s]+/).map((t) => t.replace(/^#/, '')).filter(Boolean)])] } : d;
    close();
    submitDraft(final);
  };

  const suggestions = tagText ? allTags.filter((t) => t.toLowerCase().startsWith(tagText.toLowerCase()) && !d.tags.includes(t)).slice(0, 6) : [];

  const onPaste = (e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      addFiles(files);
      return;
    }
    const target = e.target as HTMLElement;
    if (/INPUT|TEXTAREA/.test(target.tagName)) return;
    const text = e.clipboardData.getData('text');
    if (text) {
      const { url: u, rest } = splitUrl(text);
      if (u) patch({ url: u, title: d.title || (rest.length <= 120 ? rest : '') });
      else patch({ body: d.body ? d.body + '\n' + text : text });
    }
  };

  const hasMedia = d.files.length + d.keepMedia.length > 0;

  return (
    <Modal
      open
      onClose={close}
      full
      width={720}
      labelledBy="composer-title"
      title={<span id="composer-title">{editing ? '수정' : '담기'}</span>}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => patch({ favorite: !d.favorite })}
            aria-pressed={d.favorite}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[14px] font-semibold ${d.favorite ? 'text-ink' : 'text-mute hover:text-ink'}`}
          >
            {d.favorite ? <OkMark on size={20} /> : <span className="block h-4 w-4 rounded-full border-[1.5px] border-current" />}
            즐겨찾기
          </button>
          <div className="flex-1" />
          {!compact && <span className="text-[12px] text-faint">Ctrl+Enter</span>}
          <Button onClick={close}>취소</Button>
          <Button variant="primary" disabled={!canSave} onClick={submit}>
            {editing ? '저장' : '담기'}
          </Button>
        </div>
      }
    >
      <div
        className="space-y-5 px-5 py-5"
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            e.stopPropagation();
            addFiles(e.dataTransfer.files);
          }
        }}
      >
        {/* 파일 */}
        <input ref={fileRef} type="file" multiple hidden accept="image/*,video/*,application/pdf,*/*" onChange={(e) => e.target.files && (addFiles(e.target.files), (e.target.value = ''))} />
        {hasMedia ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {d.keepMedia.map((m) => (
              <KeptThumb key={m.path} m={m} onRemove={() => patch({ keepMedia: d.keepMedia.filter((x) => x !== m) })} />
            ))}
            {d.files.map((f, i) => (
              <NewFileThumb key={`${f.name}-${i}-${f.size}`} file={f} onRemove={() => patch({ files: d.files.filter((x) => x !== f) })} />
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} className="grid h-24 w-24 shrink-0 place-items-center rounded-md border border-dashed border-line text-mute hover:text-ink" aria-label="파일 더 넣기">
              <Plus size={20} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-center transition ${dragOver ? 'border-mark bg-raise' : 'border-line hover:border-mute'}`}
          >
            <Upload size={20} className="text-mute" />
            <span className="text-[14px] font-semibold">{compact ? '사진 · 영상 · 파일 고르기' : '이미지 · 영상 · 파일을 끌어다 놓거나 붙여넣기'}</span>
            <span className="text-[12px] text-faint">여러 개를 한 게시글에 담을 수 있습니다 · 파일 하나 최대 50MB</span>
          </button>
        )}

        <Field label="링크 또는 임베드 코드" hint="유튜브 · 쇼츠 · 인스타그램 · 틱톡 · 비메오 · X · 스포티파이 주소, 또는 <iframe> 코드">
          <input
            data-autofocus={!hasMedia && !d.url ? true : undefined}
            className={inputCls}
            value={d.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://"
            inputMode="url"
            autoComplete="off"
          />
          <PreviewCard p={d.url && d.previewFor === d.url.trim() ? d.preview : null} loading={loading && !!d.url} />
        </Field>

        <Field label="제목">
          <input className={inputCls} value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder={d.preview?.link?.title || '비워 두면 링크 제목이나 파일 이름을 씁니다'} />
        </Field>

        <Field label="메모">
          <textarea className={`${inputCls} min-h-[96px] resize-y leading-relaxed`} value={d.body} onChange={(e) => patch({ body: e.target.value })} placeholder="생각, 대사, 문장, 아이디어 …" rows={4} />
        </Field>

        <Field label="왜 담았나요?" hint="한 줄이면 충분합니다. 나중에 찾을 때 가장 도움이 됩니다.">
          <input className={inputCls} value={d.why} onChange={(e) => patch({ why: e.target.value })} placeholder="예: 첫 3초 전환 방식이 좋다" />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-mute">카테고리</span>
          <CategoryPicker value={d.category_id} onChange={(id) => patch({ category_id: id })} />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-mute">태그</span>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-bg px-2 py-1.5 focus-within:border-mute">
            {d.tags.map((t) => (
              <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-raise pl-2.5 pr-1 text-[13px] font-semibold">
                #{t}
                <button type="button" aria-label={`${t} 태그 빼기`} onClick={() => patch({ tags: d.tags.filter((x) => x !== t) })} className="grid h-5 w-5 place-items-center rounded-full text-mute hover:text-ink">
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagText);
                }
                if (e.key === 'Backspace' && !tagText && d.tags.length) patch({ tags: d.tags.slice(0, -1) });
              }}
              onBlur={() => tagText && addTag(tagText)}
              placeholder={d.tags.length ? '' : '전환, 타이포, 색감 … (Enter로 추가)'}
              className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-[14px] outline-none placeholder:text-faint"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestions.map((t) => (
                <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addTag(t)} className="h-7 rounded-full bg-raise px-2.5 text-[13px] text-mute hover:text-ink">
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
