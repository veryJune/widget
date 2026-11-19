# MoodGrid

이미지 · 메모 · 링크를 모아 배치하는 **개인용 무드보드**. 프로젝트를 클라우드에 저장하고 드롭다운으로 바로 전환 · 복제 · 삭제 · 복구합니다.

- 스택: React 19 · TypeScript · Vite · Tailwind v4 · Zustand · dnd-kit · Supabase (StealBook 과 같은 프로젝트·같은 계정)
- 환경변수가 없으면 **체험 모드**(이 브라우저에만 저장)로 동작 — 로그인 없이 바로 써 볼 수 있음

## 주요 기능
| 영역 | 내용 |
|---|---|
| 프로젝트 | 제목을 눌러(`Ctrl+K`) 전환 · 검색 · 새로 만들기 · 이름 바꾸기 · 복제 · 휴지통(30일) · 복구 · 영구 삭제. 목록에 커버 모자이크 |
| 저장 | 자동 저장(0.7초 묶음) + 상태 칩(저장됨 · 저장 중 · 실패/오프라인 시 자동 재시도) · 되돌리기/다시 실행(100단계) |
| 선택 · 이동 | 빈 곳 끌기=박스 선택 · Ctrl/Shift 클릭 · 카드 끌기(여러 장 한 번에) · 섹션 머리글에 놓기 · "섹션으로 이동" 메뉴 · 섹션 위/아래 이동 |
| 보기 | 열 수 · 카드 간격 슬라이더 · 정렬(직접/최신/오래된/별점/색상) · 별점 필터 · 섹션 접기 · 고정 |
| 크게 보기 | 필름스트립 · 휠/핀치 확대 · 더블클릭 100% · 키보드 별점 · 정보/메모/대표 색 패널 |
| 입력 | 파일 · 붙여넣기 · 끌어다 놓기(웹 이미지 포함) · 링크는 제목/대표 이미지 자동 |
| 내보내기 | PNG(보이는 그대로) · 백업 .zip · 예전 `.json`/이 브라우저의 예전 보드 가져오기 |

단축키는 앱에서 `?` 키.

## 개발
```bash
cp .env.example .env      # (선택) Supabase 값을 넣으면 클라우드 모드
npm install
npm run dev               # http://localhost:5174
npm run build             # 타입 검사 + 빌드
```

## 구조
```
src/
  store.ts            모든 상태와 동작 (저장 큐 · 되돌리기 · 프로젝트 · 가져오기)
  lib/order.ts        순서(pos) · 이동 · 정렬 계산 — 화면과 무관한 순수 함수
  lib/backend/        저장소 교체 지점: supabase.ts(클라우드) / local.ts(체험)
  lib/media.ts        브라우저 안에서 WebP 변환 · 썸네일 · 대표 색
  lib/legacy.ts       예전 MoodGrid 데이터 가져오기 (모든 값 검증)
  lib/backup.ts       .zip 백업
  components/         Board · Card · Lightbox · ProjectSwitcher · Header …
api/unfurl.ts         링크 미리보기 · 이미지 사본 받기 (SSRF 방어, 로그인 필요)
public/legacy/        예전 단일 HTML 버전 (/legacy/) — 새 버전이 자리잡으면 삭제
supabase/schema.sql   mg_projects · mg_items · moodgrid 버킷 · RLS
```

## 연결된 상태 (2026-11-19)
| 항목 | 값 |
|---|---|
| Vercel 프로젝트 | `moodgrid` (팀 v-june, Root Directory `MoodGrid`, 리전 icn1) |
| Supabase 프로젝트 | `steal-book` 와 공유 (서울) — `moodgrid_initial` 마이그레이션 적용됨 |
| 추가된 것 | 표 `mg_projects` · `mg_items`, 비공개 버킷 `moodgrid`(20MB·이미지 형식만), RLS 정책. StealBook 표는 그대로 |
| 로그인 | StealBook 과 같은 계정. 가입은 `stealbook_single_owner` 트리거가 프로젝트 전체에서 차단 |
| 환경변수 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`(공개 키 `sb_publishable_…`)가 production · preview · development 에 등록됨. service role 키는 쓰지 않음 |

처음부터 다시 만들거나 다른 곳에 하나 더 만들 때: Supabase SQL Editor 에 `supabase/schema.sql` 전체를 붙여넣고 Run (여러 번 실행해도 안전) → Vercel 에 위 환경변수 2개 등록.

## 배포
- Vercel 프로젝트 `moodgrid` (팀 v-june), Root Directory `MoodGrid`, 리전 icn1
- main 에 푸시하면 프로덕션, 다른 브랜치는 미리보기
- `vercel.json`: CSP · 보안 헤더 · noindex (`/legacy/` 는 CSP 제외)

## 알아둘 점
- 저장하지 않은 변경이 있거나 업로드 중이면 탭을 닫을 때 경고
- 오프라인에서 한 변경은 메모리에 보관했다가 연결되면 저장 — 그 사이 탭을 닫으면 사라짐
- 다른 기기에서 고친 내용은 탭으로 돌아올 때(30초 이상 지났고 저장할 게 없으면) 다시 불러옴 — 두 기기에서 동시에 고치면 나중에 저장한 쪽이 이김
- 항목 삭제는 휴지통 방식(30일 뒤 영구 삭제). 항목 휴지통 화면은 아직 없음(Ctrl+Z 로 복구)
