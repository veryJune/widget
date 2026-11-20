import { useStore } from '../store';
import { Kbd, Modal } from './ui';

const GROUPS: { title: string; rows: [string[], string][] }[] = [
  {
    title: '항목 추가',
    rows: [
      [['Ctrl', 'V'], '이미지 · 링크 · 글 · 임베드 코드(<iframe …>) 붙여넣기 — Spotify · SoundCloud · Instagram · TikTok · X · Pinterest · Figma · Behance · Loom · Google Drive 링크는 바로 재생/미리보기 카드로'],
      [['끌어다 놓기'], '파일 · 웹 이미지 · 링크'],
      [['N'], '새 메모 카드'],
      [['S'], '새 섹션(구분선)'],
    ],
  },
  {
    title: '선택 · 이동',
    rows: [
      [['빈 곳 끌기'], '박스로 여러 개 선택'],
      [['Ctrl', '클릭'], '하나씩 추가/해제'],
      [['Shift', '클릭'], '범위 선택'],
      [['Ctrl', 'A'], '모두 선택'],
      [['카드 끌기'], '순서 바꾸기 · 섹션 머리글에 놓으면 그 섹션으로'],
      [['Esc'], '선택 해제'],
    ],
  },
  {
    title: '카드에 (올려둔 카드 또는 선택한 카드)',
    rows: [
      [['1', '2', '3'], '별점 (같은 숫자를 다시 누르면 해제)'],
      [['0'], '별점 지우기'],
      [['P'], '맨 위에 고정'],
      [['Delete'], '삭제 (되돌리기 가능)'],
      [['Space'], '크게 보기'],
    ],
  },
  {
    title: '보기',
    rows: [
      [['/'], '검색 · 필터 열기 (색 · 별점)'],
      [['F'], '시네마틱 모드 (UI 숨김 · 전체 화면) — Esc 로 나가기, Space 슬라이드쇼'],
      [['C'], '선택한 이미지 2~4장 비교'],
      [['우클릭'], '카드 메뉴 (별점 · 고정 · 메모 · 섹션 이동 · 비교 · 내려받기 · 삭제)'],
      [['분류 칩'], '필터 바(/)에서 이미지 · 영상 · 메모 · 링크 · 임베드만 골라 보기 (여러 개 선택 가능)'],
      [['['], '열 줄이기 (카드 크게)'],
      [[']'], '열 늘리기 (카드 작게)'],
      [['Ctrl', 'K'], '프로젝트 전환'],
      [['Ctrl', 'Z'], '되돌리기 / Shift 를 함께 누르면 다시 실행'],
    ],
  },
  {
    title: '영상 (파일을 끌어다 놓거나 메뉴 → 영상에서 프레임 캡처)',
    rows: [
      [['Space'], '재생 / 일시정지'],
      [[',', '.'], '1프레임 뒤로 / 앞으로'],
      [['←', '→'], '1초 (Shift 는 5초)'],
      [['C'], '이 장면을 타임코드와 함께 캡처'],
      [['스틸 시트'], '장면을 한꺼번에 — 균등 N장 · 간격(초) · 장면 전환 자동 감지, 새 섹션으로 묶기'],
    ],
  },
  {
    title: '비교 화면',
    rows: [
      [['휠', '끌기'], '확대 · 이동 (모든 이미지가 함께)'],
      [['S'], '2장일 때 A·B 슬라이더 / 나란히'],
      [['X'], 'A ↔ B 바꾸기'],
      [['0'], '맞춤'],
    ],
  },
  {
    title: '크게 보기 화면',
    rows: [
      [['←', '→'], '이전 / 다음'],
      [['+', '−', '0'], '확대 · 축소 · 맞춤'],
      [['더블클릭'], '맞춤 ↔ 100%'],
      [['I'], '정보·메모 패널'],
      [['Space'], '슬라이드쇼 시작 / 멈춤 (4초마다)'],
      [['1', '2', '3'], '별점'],
      [['Esc'], '닫기'],
    ],
  },
];

export function Help() {
  const open = useStore((s) => s.helpOpen);
  const setHelp = useStore((s) => s.setHelp);
  return (
    <Modal open={open} onClose={() => setHelp(false)} title="단축키" width={560}>
      <div className="space-y-6 pb-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-faint">{g.title}</h3>
            <ul className="space-y-1.5">
              {g.rows.map(([keys, desc]) => (
                <li key={desc} className="flex items-center justify-between gap-4 text-[14px]">
                  <span className="text-mute">{desc}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
