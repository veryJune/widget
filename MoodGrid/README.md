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
| 보기 | 헤더의 **보기** 팝오버에 열 수 · 카드 간격 · 정렬(직접/최신/오래된/별점/색상) · 시네마틱 모드. 섹션 접기 · 고정 |
| 검색 · 필터 | `/` 키 또는 🔍: 메모 · 제목 · 출처(파일 이름) · 카드 메모 검색, 별점 필터, **보드의 대표 색 팔레트를 눌러 색으로 찾기** — 검색 + 색 + 별점은 함께(AND) 적용, 결과 개수 표시 |
| 카드 메뉴 | 카드 우클릭: 크게 보기 · 별점 · 고정 · 메모 · 섹션으로 이동 · 비교 · 삭제 (선택한 여러 장에는 한꺼번에) |
| 시네마틱 | `F`: UI를 모두 숨기고 간격 0 · 모서리 0 · 전체 화면으로 보드만 (발표 · 피칭용). 이미지를 누르면 크게, `Space` 슬라이드쇼(4초), `Esc` 로 나가기 |
| 비교 | 이미지 2~4장 선택 → `C` 또는 선택 바의 "비교": 나란히(확대 · 이동이 모든 이미지에 함께 적용), 2장이면 A·B 슬라이더(와이프), `X` 로 A↔B 바꾸기 |
| 크게 보기 | 필름스트립 · 휠/핀치 확대 · 더블클릭 100% · 키보드 별점 · 정보/메모/대표 색 패널 |
| 입력 | 파일 · 붙여넣기 · 끌어다 놓기(웹 이미지 포함) · 링크는 제목/대표 이미지 자동 |
| 영상 | YouTube / Vimeo / 영상 파일 주소 → 재생 아이콘 카드, 누르면 안에서 재생 + 시작 시간 지정(주소에 저장). 영상 파일(내 컴퓨터)을 끌어다 놓거나 메뉴 → "영상에서 프레임 캡처" → 재생하며 `Space` · `,` `.`(프레임) · `C`(캡처)로 장면을 **타임코드(00:01:23.480)와 출처**가 붙은 이미지 카드로 저장 |
| 서비스 링크 | 붙여넣는 즉시(서버 응답 없이) 재생/미리보기 카드로: **Spotify · SoundCloud**(음악) · **Instagram · TikTok · X · Pinterest**(SNS) · **Figma · Behance**(디자인) · **Loom · Google Drive · Dailymotion · Streamable · Wistia**(영상/공유). 각 서비스의 공식 임베드 주소 규칙만 사용(`lib/providers.ts`), 위장 도메인·엉뚱한 경로는 거부. 카드에는 서비스 이름 표시 |
| 임베드 | **임베드 코드(`<iframe …>`)를 붙여넣으면** 바로 재생되는 카드로 (YouTube/Vimeo 코드는 일반 영상 카드로 — 시작 시간 유지). 링크를 붙여넣었을 때 사이트가 표준 공유 정보(oEmbed · `twitter:player` · `og:video`)로 플레이어를 알려 주면 자동으로 재생 카드가 됨. 모르는 사이트의 플레이어는 sandbox iframe 으로 재생 |
| 휴지통 | 지운 카드는 메뉴 → 휴지통에서 복구 · 영구 삭제 · 비우기 (30일 뒤 자동 삭제) |
| 내보내기 | PNG(보이는 그대로) · 백업 .zip · 예전 HTML 버전의 `.json`/이 브라우저의 예전 보드 가져오기 (예전 버전 파일 자체는 git 기록의 커밋 414c193 `MoodGrid.html` 에서 복원 가능) |

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
- `vercel.json`: CSP · 보안 헤더 · noindex

## 알아둘 점
- 저장하지 않은 변경이 있거나 업로드 중이면 탭을 닫을 때 경고
- 저장 전 변경은 이 브라우저의 **저장 대기함(IndexedDB `moodgrid-outbox`)** 에 먼저 적어 두고, 서버 저장에 성공하면 지움 — 오프라인이거나 탭을 닫아도 다음에 열 때 자동 복구해 저장(업로드 중이던 이미지는 제외)
- 다른 기기에서 고친 내용은 탭으로 돌아올 때(30초 이상 지났고 저장할 게 없으면) 다시 불러옴 — 두 기기에서 동시에 고치면 나중에 저장한 쪽이 이김(복구되는 대기함 변경도 마찬가지)
- YouTube / Vimeo 는 브라우저 보안상 프레임 캡처 불가 — 화면 캡처를 `Ctrl+V` 로 붙여넣으세요. 영상 파일은 브라우저에서 재생되는 형식(MP4/H.264 · WebM)만 가능하고, 원본 영상은 업로드하지 않음(캡처한 장면만 저장)
- 영상 파일 주소(.mp4)에서 캡처하려면 그 서버가 CORS 를 허용해야 함
- 서비스별 플레이어(Instagram · TikTok · X · Figma 등)는 각 서비스가 로그인·쿠키·지역·공개 설정으로 재생을 막을 수 있음 — 그 경우 원본 링크 열기를 사용. 카드/재생 화면 모양은 이 환경에서 외부 접속이 막혀 실제 서비스 화면으로는 확인하지 못했고 주소 규칙만 검증함
- 임베드 플레이어(`frame-src https:`)는 https 만 허용하고 `sandbox`(스크립트 · 전체 화면 허용, 상위 화면 이동 · 폼 제출 불가)로 가둠. 사이트가 다른 사이트 안에서의 재생을 막으면 재생되지 않음(원본 링크 열기 사용)
- `mg_items.embed` 열(플레이어 주소, https 만)이 필요함 — `supabase/schema.sql` 적용. 열이 없는 예전 DB 에서도 일반 저장은 동작(embed 가 있는 항목만 저장 실패)
