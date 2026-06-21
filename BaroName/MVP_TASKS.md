# MVP Development Tasks

작성일: 2026-06-21

## 1. MVP 목표

BaroName MVP는 개인용 웹앱으로 만든다. GitHub 저장소에서 개발하고 Vercel에 배포한다. 초기 접속은 비밀번호로 보호하며, Gemini API 키는 서버 환경변수로만 사용한다.

MVP 완료 기준:

- 비밀번호를 입력해야 앱에 접근할 수 있다.
- 브랜드 브리프를 입력하고 Gemini로 이름 후보 12개를 생성할 수 있다.
- 후보 카드를 보고 저장, 변주, 비교할 수 있다.
- 프로젝트를 로컬에 저장하고 가져오기/내보내기 할 수 있다.
- 짧은 시간에 Gemini 요청이 과도하게 반복되지 않는다.
- Vercel 배포가 가능하다.

## 2. 추천 기술 스택

권장:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui 또는 직접 구성한 최소 컴포넌트
- lucide-react
- Zod
- zod-to-json-schema
- localStorage 또는 IndexedDB

초기 저장:

- 단순 MVP: localStorage
- 후보와 프로젝트가 많아질 경우: IndexedDB

추천:

- 첫 버전은 localStorage로 시작한다.
- Import/Export JSON을 제공해 여러 컴퓨터 사용 문제를 완화한다.

## 3. 환경변수

로컬 `.env.local`:

```text
GEMINI_API_KEY=
APP_PASSWORD=
SESSION_SECRET=
GEMINI_MODEL=gemini-3.5-flash
GENERATION_COOLDOWN_SECONDS=8
```

Vercel 환경변수:

- `GEMINI_API_KEY`
- `APP_PASSWORD`
- `SESSION_SECRET`
- `GEMINI_MODEL`
- `GENERATION_COOLDOWN_SECONDS`

주의:

- `GEMINI_API_KEY`는 클라이언트에 노출하지 않는다.
- `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## 4. 개발 단계

### Phase 0. 프로젝트 부트스트랩

- Next.js 앱 생성
- TypeScript 설정
- Tailwind 설정
- ESLint/Prettier 또는 기본 포맷 설정
- 기본 폴더 구조 생성
- Vercel 배포 가능한 기본 페이지 확인

완료 기준:

- 로컬에서 앱이 실행된다.
- 기본 화면이 Vercel에 배포 가능한 구조다.

### Phase 1. 비밀번호 접근 보호

작업:

- 잠금 화면 `PasswordGate` 작성
- `/api/auth/unlock` API 작성
- `APP_PASSWORD` 검증
- 성공 시 httpOnly 세션 쿠키 발급
- 미인증 사용자는 앱 화면 접근 제한
- 로그아웃 또는 세션 만료 처리

권장:

- MVP에서는 단일 비밀번호 방식
- 추후 로그인 기능을 위해 인증 로직을 `auth` 모듈로 분리

완료 기준:

- 비밀번호 없이는 앱이 보이지 않는다.
- 비밀번호 성공 후 앱 화면으로 진입한다.

### Phase 2. 앱 셸과 레이아웃

작업:

- `AppShell`
- `TopBar`
- 3단 데스크톱 레이아웃
- 모바일 탭 레이아웃
- 빈 상태 화면
- 기본 디자인 토큰

완료 기준:

- 데스크톱에서 좌측/중앙/우측 패널이 안정적으로 보인다.
- 모바일에서 Brief/Studio/Picks 탭으로 사용할 수 있다.

### Phase 3. 브랜드 브리프 입력

작업:

- Category select
- One-line brief textarea
- Keyword chips
- Audience input
- Tone chips
- Creativity slider
- Language select
- Naming engine selector
- Must include input
- Banned words input
- 입력 상태 저장

완료 기준:

- 필수 입력값이 없으면 생성 버튼이 비활성화된다.
- 입력값이 새로고침 후에도 유지된다.

### Phase 4. Gemini 서버 API

작업:

- `/api/generate` 작성
- `/api/variation` 작성
- Gemini REST API 호출 구성
- JSON Schema 작성
- 서버 응답 정규화 로직 작성
- 프롬프트 템플릿 구성
- 응답 검증 및 정리
- 서버 에러 처리

무료 티어 보호:

- 서버 단위 동시 요청 방지
- 클라이언트 재클릭 완충 8초
- 동일 브리프 해시 캐시
- 429 응답 처리
- 자동 재시도 1회 이하

완료 기준:

- 입력값으로 후보 12개를 JSON으로 받아 카드에 표시할 수 있다.
- API 키가 브라우저 네트워크 응답에 노출되지 않는다.

### Phase 5. 후보 카드

작업:

- `CandidateCard`
- `CandidateList`
- 카드 점수 표시
- 글로벌 적합성 배지
- 리스크 표시
- Pick 액션
- Copy 액션
- More like this 등 변주 액션
- Loading placeholder
- Error state

완료 기준:

- 12개 후보를 보기 좋게 스캔할 수 있다.
- 후보를 저장하거나 변주 요청할 수 있다.

### Phase 6. Picks 패널과 선호 요약

작업:

- Picks 최대 7개 저장
- Pick 삭제
- Pick 정렬
- 클라이언트 기반 preference summary
- 선택 후보 기반 다음 생성 옵션

완료 기준:

- 저장 후보가 우측 패널에 반영된다.
- 저장 후보의 공통 스타일을 간단히 요약한다.

### Phase 7. 비교 모드

작업:

- 2개 이상 후보 비교
- 점수 매트릭스
- 이름 길이/음절 표시
- 글로벌 적합성 비교
- 리스크 비교
- 최종 후보 체크리스트

완료 기준:

- 후보 2~5개를 한 화면에서 비교할 수 있다.

### Phase 8. 로컬 프로젝트 저장

작업:

- 프로젝트 생성
- 프로젝트 이름 변경
- 프로젝트 삭제
- 브리프/설정/후보/픽 저장
- 자동 저장
- Import JSON
- Export current project JSON
- Export TXT/CSV

완료 기준:

- 새로고침 후에도 프로젝트와 후보가 유지된다.
- 다른 컴퓨터로 옮길 수 있게 JSON 내보내기/가져오기가 가능하다.

### Phase 9. Vercel 배포 준비

작업:

- 환경변수 문서화
- Vercel 배포 설정 확인
- 빌드 오류 수정
- production cookie 설정
- 기본 보안 헤더 검토

완료 기준:

- GitHub 연결 후 Vercel에서 배포된다.
- 배포 URL에서 비밀번호 접근이 작동한다.
- Gemini 생성이 서버에서 정상 작동한다.

### Phase 10. MVP QA

테스트 시나리오:

- 비밀번호 실패/성공
- 필수 입력 누락
- 후보 12개 생성
- Pick 추가/삭제
- 변주 생성
- 비교 모드
- Export/Import
- 429 rate limit mock
- 모바일 화면
- 새로고침 후 데이터 유지

완료 기준:

- 개인 사용 플로우가 끊기지 않는다.
- API 실패 시에도 기존 후보와 프로젝트가 사라지지 않는다.

## 5. 추천 폴더 구조

```text
BaroName/
  app/
    page.tsx
    layout.tsx
    api/
      auth/
        unlock/route.ts
      generate/route.ts
      variation/route.ts
  components/
    app-shell.tsx
    password-gate.tsx
    brief-panel.tsx
    creativity-slider.tsx
    engine-selector.tsx
    generation-toolbar.tsx
    candidate-card.tsx
    candidate-list.tsx
    picks-panel.tsx
    compare-view.tsx
    project-manager.tsx
  lib/
    auth.ts
    gemini.ts
    prompts.ts
    schemas.ts
    storage.ts
    rate-limit.ts
    project.ts
  styles/
    globals.css
```

## 6. 우선순위

반드시 먼저:

1. 비밀번호 접근 보호
2. Gemini API 서버 호출
3. 후보 12개 생성
4. 후보 카드와 Pick
5. 로컬 저장

그 다음:

6. 변주 액션
7. 비교 모드
8. 내보내기/가져오기
9. 모바일 정리
10. Vercel 배포 QA

나중:

- 로그인
- 클라우드 저장
- 도메인/SNS 체크
- 브랜드 키트
- 유료화

## 7. 유료화 대비 설계 포인트

MVP에서 과하게 만들 필요는 없지만 아래 경계는 남겨둔다.

- `features` 설정 객체
- `usage` 기록 구조
- `project.storageProvider`
- `authProvider`
- `plan` 필드

예:

```ts
type UserPlan = "private_free" | "personal_paid" | "pro";
```

초기에는 단일 사용자라 실제 결제/계정은 만들지 않는다.

## 8. 오픈 이슈

구현 전에 다시 확인하면 좋은 것:

- Vercel 배포 도메인을 어떤 이름으로 할지
- 비밀번호 세션 유지 기간
- localStorage로 충분한지, IndexedDB로 시작할지
- Gemini 모델을 구현 시점에 어떤 무료 Flash 계열로 고정할지
- 한글 UI 문구와 영어 UI 문구 중 무엇을 기본으로 할지
