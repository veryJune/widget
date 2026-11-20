// 프로젝트 전환 · 관리 (제목을 누르면 열림, Ctrl+K)
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Copy, FileUp, FolderOpen, ImageIcon, Loader2, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { relTime } from '../lib/util';
import { useClickAway } from '../hooks/useClickAway';
import type { Project } from '../types';
import { IconButton } from './ui';

function Mosaic({ project }: { project: Project }) {
  const urls = useStore((s) => s.urls);
  const covers = project.covers.slice(0, 4);
  return (
    <div className="grid h-11 w-11 shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg bg-line">
      {[0, 1, 2, 3].map((i) => {
        const u = covers[i] ? urls[covers[i]] : undefined;
        return u ? <img key={i} src={u} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" /> : <div key={i} className="flex items-center justify-center bg-raise">{i === 0 && covers.length === 0 ? <ImageIcon size={12} className="text-faint" /> : null}</div>;
      })}
    </div>
  );
}

export function ProjectSwitcher() {
  const projects = useStore((s) => s.projects);
  const currentId = useStore((s) => s.currentId);
  const open = useStore((s) => s.switcherOpen);
  const setOpen = useStore((s) => s.setSwitcher);
  const legacy = useStore((s) => s.legacy);
  const busy = useStore((s) => s.busy);
  const act = useStore.getState;
  const current = projects.find((p) => p.id === currentId);

  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useClickAway(ref, () => setOpen(false), open);

  const live = useMemo(() => projects.filter((p) => !p.deleted_at).filter((p) => p.title.toLowerCase().includes(q.trim().toLowerCase())), [projects, q]);
  const trash = useMemo(() => projects.filter((p) => p.deleted_at), [projects]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setRenaming(null);
      act().ensureUrls(projects.flatMap((p) => p.covers));
    }
    // 열릴 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [q]);

  const commitRename = () => {
    if (renaming) void act().renameProject(renaming, draft);
    setRenaming(null);
  };
  const create = async () => {
    setCreating(true);
    try {
      await act().createProject();
    } catch (e) {
      act().toast(`만들지 못했습니다: ${(e as Error).message}`, { kind: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} title="프로젝트 전환 (Ctrl+K)" className="flex h-10 max-w-full items-center gap-2 rounded-lg px-2.5 text-left transition hover:bg-raise">
        <span className="truncate text-[16px] font-bold tracking-tight">{current?.title ?? '프로젝트'}</span>
        <ChevronDown size={16} className={`shrink-0 text-mute transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="sheet-up absolute left-0 top-full z-[55] mt-2 flex max-h-[min(78vh,640px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" role="dialog" aria-label="프로젝트">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search size={16} className="text-faint" />
            <input
              data-autofocus
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(live.length - 1, a + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === 'Enter' && live[active]) void act().openProject(live[active].id);
              }}
              placeholder="프로젝트 검색…"
              className="h-8 min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-faint focus:outline-none"
            />
          </div>

          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox">
            {live.map((p, i) => {
              const isCur = p.id === currentId;
              return (
                <li key={p.id} role="option" aria-selected={isCur} className={`group flex items-center gap-3 rounded-xl p-2 ${i === active ? 'bg-raise' : 'hover:bg-raise/60'}`} onMouseEnter={() => setActive(i)}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => renaming !== p.id && void act().openProject(p.id)}>
                    <Mosaic project={p} />
                    <span className="min-w-0 flex-1">
                      {renaming === p.id ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitRename}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          maxLength={100}
                          className="h-7 w-full rounded-md border border-mark bg-bg px-2 text-[15px] font-semibold focus:outline-none"
                        />
                      ) : (
                        <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                          <span className="truncate">{p.title}</span>
                          {isCur && <Check size={14} className="shrink-0 text-mark" />}
                        </span>
                      )}
                      <span className="num block text-[12px] text-faint">
                        {p.item_count}개 · {relTime(p.updated_at)}
                      </span>
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                    <IconButton label="이름 바꾸기" onClick={() => { setRenaming(p.id); setDraft(p.title); }} className="!h-8 !w-8">
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label="복제" onClick={() => void act().duplicateProject(p.id)} className="!h-8 !w-8">
                      <Copy size={14} />
                    </IconButton>
                    <IconButton label="휴지통으로" onClick={() => void act().trashProject(p.id)} className="!h-8 !w-8 hover:!text-[#e5534b]">
                      <Trash2 size={14} />
                    </IconButton>
                  </span>
                </li>
              );
            })}
            {live.length === 0 && <li className="px-3 py-8 text-center text-[14px] text-mute">{q ? '검색 결과가 없습니다.' : '프로젝트가 없습니다.'}</li>}
          </ul>

          {legacy && (
            <div className="mx-2 mb-2 rounded-xl border border-mark/40 bg-mark/10 p-3 text-[13px]">
              <p className="font-semibold">이 브라우저에 예전 MoodGrid 보드가 있어요</p>
              <p className="mt-0.5 text-mute">‘{legacy.title}’ · {legacy.count}개 항목. 새 프로젝트로 가져옵니다.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={!!busy} className="h-8 rounded-lg bg-ink px-3 text-[13px] font-semibold text-bg disabled:opacity-50" onClick={() => { setOpen(false); void act().importLegacyLocal(); }}>
                  가져오기
                </button>
                <button type="button" className="h-8 rounded-lg px-3 text-[13px] font-semibold text-mute hover:bg-raise" onClick={() => act().dismissLegacy()}>
                  숨기기
                </button>
              </div>
            </div>
          )}

          {showTrash && trash.length > 0 && (
            <ul className="scroll-thin max-h-40 overflow-y-auto border-t border-line p-1.5">
              {trash.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[14px]">
                  <span className="min-w-0 flex-1 truncate text-mute">{p.title}</span>
                  <button type="button" className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-mute hover:bg-raise hover:text-ink" onClick={() => void act().restoreProject(p.id)}>
                    <RotateCcw size={12} /> 복구
                  </button>
                  <button
                    type="button"
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-[#e5534b] hover:bg-raise"
                    onClick={async () => {
                      if (await act().confirm({ title: `'${p.title}' 영구 삭제`, body: '프로젝트와 안의 이미지가 완전히 삭제되며 되돌릴 수 없습니다.', confirm: '영구 삭제', danger: true })) void act().purgeProject(p.id);
                    }}
                  >
                    영구 삭제
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-1 border-t border-line p-2">
            <button type="button" onClick={create} disabled={creating} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink text-[14px] font-semibold text-bg transition hover:opacity-90 disabled:opacity-50">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} 새 프로젝트
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) {
                  setOpen(false);
                  void act().importFile(f);
                }
              }}
            />
            <IconButton label="파일에서 가져오기 (.zip · 예전 .json)" onClick={() => fileRef.current?.click()}>
              <FileUp size={17} />
            </IconButton>
            {trash.length > 0 && (
              <IconButton label={`휴지통 (${trash.length})`} active={showTrash} onClick={() => setShowTrash((v) => !v)}>
                <FolderOpen size={17} />
              </IconButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
