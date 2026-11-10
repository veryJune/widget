// 설정: 화면 테마, 동기화 상태, 저장 공간, 백업, 앱 설치, 단축키
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, Download, HardDrive, KeyRound, LogOut, Smartphone, Upload } from 'lucide-react';
import { useStore } from '../store';
import { backend } from '../lib/backend';
import { exportJson, importJson, localLeftovers, migrateLocalToCloud } from '../lib/backup';
import { fmtBytes } from '../lib/util';
import { Button, Modal, inputCls } from './ui';
import { ThemePicker } from './Theme';

const FREE_STORAGE = 1024 ** 3; // Supabase 무료 파일 저장 1GB

type InstallEvent = Event & { prompt: () => Promise<void> };
declare global {
  interface Window {
    __installPrompt?: InstallEvent | null;
  }
}

function PasswordForm() {
  const toast = useStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <Button variant="ghost" className="px-0" onClick={() => setOpen(true)}>
        <KeyRound size={15} /> 비밀번호 바꾸기
      </Button>
    );
  const mismatch = pw2.length > 0 && pw !== pw2;
  return (
    <form
      className="space-y-2 rounded-lg bg-bg p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 8 || pw !== pw2) return;
        setBusy(true);
        try {
          await backend.changePassword(pw);
          toast('비밀번호를 바꿨습니다');
          setOpen(false);
          setPw('');
          setPw2('');
        } catch (err) {
          toast((err as Error).message || '비밀번호를 바꾸지 못했습니다.', { kind: 'error' });
        } finally {
          setBusy(false);
        }
      }}
    >
      <input type="password" autoComplete="new-password" placeholder="새 비밀번호 (8자 이상)" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
      <input type="password" autoComplete="new-password" placeholder="한 번 더" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} />
      {mismatch && <p className="text-[12px] text-[#e5534b]">두 비밀번호가 다릅니다.</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="h-9" disabled={busy || pw.length < 8 || pw !== pw2}>
          바꾸기
        </Button>
        <Button className="h-9" onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-0">
      <h3 className="mb-3 text-[13px] font-semibold text-mute">{title}</h3>
      {children}
    </section>
  );
}

export function Settings() {
  const { panel, set, session, signOut, categories, items, refresh, toast } = useStore();
  const open = panel === 'settings';
  const fileRef = useRef<HTMLInputElement>(null);
  const [leftover, setLeftover] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(!!window.__installPrompt);

  useEffect(() => {
    if (!open) return;
    localLeftovers().then(setLeftover);
    setCanInstall(!!window.__installPrompt);
  }, [open]);

  const used = useMemo(() => items.reduce((sum, i) => sum + i.media.reduce((s, m) => s + (m.size || 0) + (m.thumbSize || 0) + (m.stripSize || 0), 0), 0), [items]);
  const pct = Math.min(100, (used / FREE_STORAGE) * 100);

  return (
    <Modal open={open} onClose={() => set({ panel: null })} title="설정" width={560}>
      <Section title="화면">
        <ThemePicker long />
      </Section>

      <Section title="저장 · 동기화">
        {backend.mode === 'cloud' ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[14px]">
              <Cloud size={16} className="text-mute" /> 여러 기기와 동기화 중 {session?.email && <span className="text-mute">({session.email})</span>}
            </p>
            <div>
              <div className="mb-1 flex justify-between text-[12px] text-mute">
                <span>파일 저장 공간 (무료 1GB 기준)</span>
                <span className="num">
                  {fmtBytes(used)} / 1GB
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(1, pct)}%`, background: pct > 85 ? 'var(--mark)' : undefined }} />
              </div>
              {pct > 85 && <p className="mt-1.5 text-[12px] text-mute">공간이 거의 찼습니다. 큰 영상은 링크로 담거나, 나중에 파일 저장소를 Cloudflare R2(무료 10GB)로 옮길 수 있습니다.</p>}
            </div>
            {leftover > 0 && (
              <div className="rounded-lg bg-bg p-3 text-[13px]">
                <p className="mb-2">이 기기에 체험 모드로 담아 둔 항목이 {leftover}개 있습니다.</p>
                <Button
                  className="h-8 px-3 text-[13px]"
                  disabled={!!busy}
                  onClick={async () => {
                    try {
                      const n = await migrateLocalToCloud(setBusy);
                      setLeftover(0);
                      await refresh();
                      toast(`${n}개를 클라우드로 옮겼습니다`);
                    } catch (e) {
                      toast((e as Error).message || '옮기지 못했습니다.', { kind: 'error' });
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy || '클라우드로 옮기기'}
                </Button>
              </div>
            )}
            <div className="flex flex-col items-start gap-1">
              <PasswordForm />
              <Button variant="ghost" className="px-0" onClick={signOut}>
                <LogOut size={15} /> 로그아웃
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-[14px]">
            <p className="flex items-center gap-2">
              <HardDrive size={16} className="text-mute" /> 체험 모드: 이 브라우저에만 저장됩니다.
            </p>
            <p className="text-[13px] text-mute">여러 PC·휴대폰에서 같이 쓰려면 SETUP.md의 순서대로 Supabase를 연결하세요. 연결 후 설정 화면에서 지금 담은 것들을 클라우드로 옮길 수 있습니다.</p>
          </div>
        )}
      </Section>

      <Section title="백업">
        <p className="mb-3 text-[13px] text-mute">글·링크·카테고리 정보를 파일 하나(JSON)로 내려받습니다. 올린 사진·영상 원본은 저장소에 그대로 남아 있습니다.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportJson(categories, items)}>
            <Download size={15} /> 백업 내려받기
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> 백업 불러오기
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const r = await importJson(f);
                await refresh();
                toast(`항목 ${r.items}개, 카테고리 ${r.categories}개를 불러왔습니다`);
              } catch (err) {
                toast((err as Error).message || '불러오지 못했습니다.', { kind: 'error' });
              }
            }}
          />
        </div>
      </Section>

      <Section title="크롬 확장 · 오른쪽 클릭으로 훔치기 (PC)">
        <p className="mb-3 text-[13px] leading-relaxed text-mute">
          웹에서 이미지·링크·페이지·선택한 글에 <b className="text-ink">오른쪽 클릭 → Steal Book에 훔치기</b>. 작은 창이 열려 메모를 달거나 <b className="text-ink">바로 담기</b>로 한 번에 저장합니다.
          이 크롬에서 Steal Book에 로그인해 두면 따로 로그인할 필요가 없습니다.
        </p>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-[13px] text-mute">
          <li>아래 버튼으로 내려받아 압축 풀기</li>
          <li>
            크롬 주소창에 <code className="rounded bg-bg px-1 text-ink">chrome://extensions</code> → 오른쪽 위 <b className="text-ink">개발자 모드</b> 켜기
          </li>
          <li>
            <b className="text-ink">압축해제된 확장 프로그램 로드</b> → 풀어 둔 <code className="rounded bg-bg px-1 text-ink">steal-book-extension</code> 폴더 선택
          </li>
          <li>퍼즐 모양 아이콘에서 Steal Book을 고정하면 버튼 한 번(또는 Alt+Shift+S)으로 지금 페이지를 담습니다</li>
        </ol>
        <a href="/stealbook-extension.zip" download className="inline-flex h-10 items-center gap-2 rounded-lg bg-raise px-4 text-[14px] font-semibold hover:bg-line">
          <Download size={15} /> 확장 내려받기 (.zip)
        </a>
      </Section>

      <Section title="휴대폰 앱처럼 쓰기">
        <p className="mb-3 text-[13px] text-mute">
          안드로이드 크롬에서 메뉴 → <b className="text-ink">홈 화면에 추가(앱 설치)</b>를 하면, 유튜브·인스타그램의 <b className="text-ink">공유</b> 목록에 Steal Book이 나타납니다.
        </p>
        {canInstall && (
          <Button
            onClick={async () => {
              await window.__installPrompt?.prompt();
              window.__installPrompt = null;
              setCanInstall(false);
            }}
          >
            <Smartphone size={15} /> 지금 앱으로 설치
          </Button>
        )}
      </Section>

      <Section title="단축키 (PC)">
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[13px]">
          {[
            ['Ctrl+V', '어디서든 붙여넣어 바로 담기'],
            ['N', '새로 담기'],
            ['/', '검색'],
            ['1 · 2 · 3', '벽돌 · 그리드 · 목록 보기'],
            ['T', '시어터'],
            ['L', '밝게 ↔ 어둡게'],
            ['Ctrl+클릭 · Shift+클릭', '여러 개 선택 · 범위 선택'],
            ['← →', '상세 보기에서 이전·다음'],
            ['F · E', '즐겨찾기 · 수정'],
            ['I · O', '영상 구간 시작 · 끝 표시'],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded bg-bg px-1.5 py-0.5 text-[12px] font-semibold">{k}</kbd>
              </dt>
              <dd className="text-mute">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </Modal>
  );
}
