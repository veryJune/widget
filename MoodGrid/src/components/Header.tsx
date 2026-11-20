import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckSquare, Download, FileArchive, HelpCircle, ImagePlus, ImageDown, LayoutGrid, Loader2, LogOut, Menu, Moon, Redo2, Shuffle, SlidersHorizontal, Split, Sun, Type, Undo2, WifiOff, KeyRound, ArrowUpFromLine } from 'lucide-react';
import { backend } from '../lib/backend';
import { exportBoardPng } from '../lib/exportPng';
import { relTime } from '../lib/util';
import { useStore } from '../store';
import { SORT_LABEL, type SortMode } from '../types';
import { useClickAway } from '../hooks/useClickAway';
import { ProjectSwitcher } from './ProjectSwitcher';
import { IconButton } from './ui';

function StatusChip() {
  const save = useStore((s) => s.save);
  const busy = useStore((s) => s.busy);
  const uploading = useStore((s) => Object.keys(s.uploading).length);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 20000);
    return () => clearInterval(id);
  }, []);
  const act = useStore.getState;

  let body: React.ReactNode;
  let cls = 'text-mute';
  if (busy) {
    body = (
      <>
        <Loader2 size={13} className="animate-spin" /> {busy.label} <span className="num">{busy.done}/{busy.total}</span>
      </>
    );
  } else if (uploading > 0) {
    body = (
      <>
        <Loader2 size={13} className="animate-spin" /> 올리는 중 <span className="num">{uploading}</span>
      </>
    );
  } else if (save.state === 'saving') {
    body = (
      <>
        <Loader2 size={13} className="animate-spin" /> 저장 중…
      </>
    );
  } else if (save.state === 'error') {
    cls = 'text-[#e5534b]';
    body = (
      <>
        <AlertTriangle size={13} /> 저장 실패 · 다시 시도
      </>
    );
  } else if (save.state === 'offline') {
    cls = 'text-[#e5534b]';
    body = (
      <>
        <WifiOff size={13} /> 오프라인 · 연결되면 저장
      </>
    );
  } else {
    body = (
      <>
        <Check size={13} className="text-mark" /> 저장됨 <span className="text-faint">· {relTime(save.at)}</span>
      </>
    );
  }
  const clickable = save.state === 'error' || save.state === 'offline';
  return (
    <button type="button" disabled={!clickable} onClick={() => act().retrySave()} title={save.error ?? (backend.mode === 'local' ? '체험 모드: 이 브라우저에만 저장됩니다' : '클라우드에 저장됨')} className={`hidden h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium sm:inline-flex ${cls} ${clickable ? 'hover:bg-raise' : 'cursor-default'}`} aria-live="polite">
      {body}
      {backend.mode === 'local' && <span className="ml-1 rounded bg-raise px-1.5 py-0.5 text-[10px] font-bold text-mute">체험</span>}
    </button>
  );
}

function ViewControls({ stacked = false }: { stacked?: boolean }) {
  const project = useStore((s) => s.projects.find((p) => p.id === s.currentId));
  const filter = useStore((s) => s.filter);
  const setView = useStore((s) => s.setView);
  const setFilter = useStore((s) => s.setFilter);
  if (!project) return null;
  const row = stacked ? 'flex items-center justify-between gap-4' : 'flex items-center gap-2';
  const lab = 'text-[12px] font-semibold text-mute';
  return (
    <div className={stacked ? 'space-y-4' : 'flex items-center gap-5'}>
      <label className={row} title="열 수 ( [ / ] 키 )">
        <span className={lab}>열</span>
        <input type="range" min={2} max={8} step={1} value={10 - project.cols} onChange={(e) => setView({ cols: 10 - Number(e.target.value) })} aria-label="카드 크기 (오른쪽일수록 크게)" className="w-28" />
        <span className="num w-4 text-[12px] text-faint">{project.cols}</span>
      </label>
      <label className={row} title="카드 사이 간격">
        <span className={lab}>간격</span>
        <input type="range" min={0} max={48} step={2} value={project.gap} onChange={(e) => setView({ gap: Number(e.target.value) })} aria-label="카드 간격" className="w-28" />
        <span className="num w-7 text-[12px] text-faint">{project.gap}</span>
      </label>
      <label className={row}>
        <span className={lab}>정렬</span>
        <select value={project.sort_mode} onChange={(e) => setView({ sort_mode: e.target.value as SortMode })} aria-label="정렬" className="h-8 rounded-lg border border-line bg-bg px-2 text-[13px] font-medium focus:border-mark focus:outline-none">
          {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
            <option key={m} value={m}>
              {SORT_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label className={row}>
        <span className={lab}>별점</span>
        <select value={filter} onChange={(e) => setFilter(Number(e.target.value) as 0 | 1 | 2 | 3)} aria-label="별점 필터" className="h-8 rounded-lg border border-line bg-bg px-2 text-[13px] font-medium focus:border-mark focus:outline-none">
          <option value={0}>전체</option>
          <option value={1}>★ 1 이상</option>
          <option value={2}>★ 2 이상</option>
          <option value={3}>★ 3</option>
        </select>
      </label>
    </div>
  );
}

function MenuItem({ icon, label, hint, onClick, danger, disabled }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition hover:bg-raise disabled:opacity-40 ${danger ? 'text-[#e5534b]' : ''}`}>
      <span className="text-mute">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </button>
  );
}

export function Header() {
  const project = useStore((s) => s.projects.find((p) => p.id === s.currentId));
  const theme = useStore((s) => s.theme);
  const undoCount = useStore((s) => s.undoCount);
  const redoCount = useStore((s) => s.redoCount);
  const selectMode = useStore((s) => s.selectMode);
  const session = useStore((s) => s.session);
  const act = useStore.getState;
  const [menu, setMenu] = useState(false);
  const [view, setView] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useClickAway(menuRef, () => setMenu(false), menu);
  useClickAway(viewRef, () => setView(false), view);
  const dark = theme === 'dark' || (theme === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
  const sort = project?.sort_mode ?? 'manual';

  const close = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md md:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 xl:flex-none">
        <div className="hidden h-8 w-8 shrink-0 sm:flex items-center justify-center rounded-lg bg-ink text-bg" aria-hidden>
          <LayoutGrid size={17} />
        </div>
        <ProjectSwitcher />
      </div>

      <div className="mx-auto hidden xl:block">
        <ViewControls />
      </div>

      <div className="flex shrink-0 items-center gap-1 xl:ml-0">
        <StatusChip />
        <div ref={viewRef} className="relative xl:hidden">
          <IconButton label="보기 설정 (열 · 간격 · 정렬 · 필터)" active={view} onClick={() => setView((v) => !v)}>
            <SlidersHorizontal size={18} />
          </IconButton>
          {view && (
            <div className="sheet-up absolute right-0 top-full z-[55] mt-2 w-[300px] rounded-2xl border border-line bg-panel p-4 shadow-2xl">
              <ViewControls stacked />
            </div>
          )}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) void act().addFiles(f); }} />
        <IconButton label="이미지 추가" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={18} />
        </IconButton>
        <IconButton label="메모 카드 추가 (N)" onClick={() => act().setEditor({ mode: 'new' })}>
          <Type size={18} />
        </IconButton>
        <IconButton label={sort === 'manual' ? '섹션(구분선) 추가 (S)' : "섹션은 '직접 정렬'에서만 추가할 수 있어요"} disabled={sort !== 'manual'} onClick={() => act().addDivider()} className="max-sm:hidden">
          <Split size={18} />
        </IconButton>
        <span className="mx-1 hidden h-5 w-px bg-line md:block" />
        <IconButton label="되돌리기 (Ctrl+Z)" disabled={undoCount === 0} onClick={() => act().undo()} className="max-md:hidden">
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="다시 실행 (Ctrl+Shift+Z)" disabled={redoCount === 0} onClick={() => act().redo()} className="max-md:hidden">
          <Redo2 size={18} />
        </IconButton>
        <IconButton label={dark ? '밝은 화면으로' : '어두운 화면으로'} onClick={() => act().setTheme(dark ? 'light' : 'dark')} className="max-sm:hidden">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        <div ref={menuRef} className="relative">
          <IconButton label="메뉴" active={menu} onClick={() => setMenu((v) => !v)}>
            <Menu size={19} />
          </IconButton>
          {menu && (
            <div className="sheet-up absolute right-0 top-full z-[55] mt-2 w-64 rounded-2xl border border-line bg-panel p-1.5 shadow-2xl" role="menu">
              <MenuItem icon={<Split size={16} />} label="섹션(구분선) 추가" hint="S" disabled={sort !== 'manual'} onClick={close(() => act().addDivider())} />
              <MenuItem icon={dark ? <Sun size={16} /> : <Moon size={16} />} label={dark ? '밝은 화면으로' : '어두운 화면으로'} onClick={close(() => act().setTheme(dark ? 'light' : 'dark'))} />
              <MenuItem icon={<CheckSquare size={16} />} label={selectMode ? '선택 모드 끄기' : '선택 모드 (터치용)'} hint="Esc" onClick={close(() => act().setSelectMode(!selectMode))} />
              <MenuItem icon={<Shuffle size={16} />} label="맨 위 묶음 섞기" onClick={close(() => act().shuffleTop())} disabled={sort !== 'manual'} />
              <MenuItem icon={<Undo2 size={16} />} label="되돌리기" hint="Ctrl+Z" disabled={undoCount === 0} onClick={close(() => act().undo())} />
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={<ImageDown size={16} />} label="PNG 로 내보내기" onClick={close(() => void exportBoardPng(project?.title ?? 'moodgrid'))} />
              <MenuItem icon={<FileArchive size={16} />} label="백업 내려받기 (.zip)" onClick={close(() => void act().exportBackup())} />
              <MenuItem icon={<ArrowUpFromLine size={16} />} label="파일에서 가져오기…" onClick={close(() => act().setSwitcher(true))} />
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={<HelpCircle size={16} />} label="단축키" hint="?" onClick={close(() => act().setHelp(true))} />
              <MenuItem icon={<Download size={16} />} label="예전 버전 열기" onClick={close(() => window.open('/legacy/', '_blank', 'noopener'))} />
              {backend.mode === 'cloud' && session && (
                <>
                  <div className="my-1 h-px bg-line" />
                  <MenuItem
                    icon={<KeyRound size={16} />}
                    label="비밀번호 바꾸기"
                    onClick={close(async () => {
                      const pw = window.prompt('새 비밀번호 (8자 이상)');
                      if (!pw) return;
                      try {
                        await act().changePassword(pw);
                        act().toast('비밀번호를 바꿨습니다.');
                      } catch (e) {
                        act().toast((e as Error).message, { kind: 'error' });
                      }
                    })}
                  />
                  <MenuItem icon={<LogOut size={16} />} label={`로그아웃${session.email ? ` · ${session.email}` : ''}`} danger onClick={close(() => void act().signOut())} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
