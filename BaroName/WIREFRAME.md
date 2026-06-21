# BaroName Wireframe

작성일: 2026-06-21

## 1. 화면 원칙

BaroName은 개인용 생산성 웹앱이다. 첫 화면은 랜딩 페이지가 아니라 바로 작업 가능한 네이밍 스튜디오여야 한다.

핵심 원칙:

- 영어 네이밍 우선, 글로벌 검토 중심
- 한 페이지에서 입력, 생성, 저장, 비교 완료
- 과한 설명보다 조작 가능한 컨트롤 중심
- Apple 스타일의 조용하고 정돈된 업무 도구 감각
- 개인용 Vercel 배포를 위한 비밀번호 보호

## 2. 진입 흐름

### 2.1 잠금 화면

비밀번호 인증 전에는 앱 내용을 보여주지 않는다.

```text
┌──────────────────────────────────────────────┐
│                                              │
│                  BaroName                    │
│          Private naming workspace             │
│                                              │
│         ┌──────────────────────────┐         │
│         │ Password                 │         │
│         └──────────────────────────┘         │
│                                              │
│              [ Unlock workspace ]             │
│                                              │
│   Gemini API is used server-side only.        │
│                                              │
└──────────────────────────────────────────────┘
```

잠금 화면 UX:

- 로고와 비밀번호 입력만 둔다.
- 비밀번호 실패 시 “Password is incorrect.” 정도로 짧게 표시한다.
- API 키나 설정 문구는 노출하지 않는다.
- 세션이 만료되면 같은 화면으로 돌아온다.

## 3. 데스크톱 메인 레이아웃

권장 기준: 1440px 이상 데스크톱

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ BaroName       Project: Untitled naming sprint     Saved 21:38     Settings  │
├──────────────────────┬──────────────────────────────────────┬────────────────┤
│ Brand Brief          │ Naming Studio                         │ Picks          │
│                      │                                      │                │
│ Category             │ ┌──────────────────────────────────┐ │ 3 selected     │
│ [SaaS / Web App v]   │ │  Generate names                   │ │ ┌────────────┐ │
│                      │ │  12 candidates, global-first      │ │ │ Lumora     │ │
│ One-line brief       │ └──────────────────────────────────┘ │ └────────────┘ │
│ ┌──────────────────┐ │                                      │ ┌────────────┐ │
│ │                  │ │ ┌──────────────────────────────────┐ │ │ Nuvio      │ │
│ └──────────────────┘ │ │ Candidate card                    │ │ └────────────┘ │
│                      │ │ Name / scores / rationale/actions │ │                │
│ Keywords             │ └──────────────────────────────────┘ │ Preference     │
│ [fast] [global] [+]  │                                      │ Short, vowel   │
│                      │ ┌──────────────────────────────────┐ │ ending names   │
│ Tone                 │ │ Candidate card                    │ │                │
│ [Modern] [Trust]     │ └──────────────────────────────────┘ │ [Compare]      │
│                      │                                      │ [Export]       │
│ Creativity           │                                      │                │
│ 1 ───●──── 5         │                                      │ Projects       │
│                      │                                      │ Untitled       │
│ Language             │                                      │ Channel names  │
│ [English first v]    │                                      │                │
│                      │                                      │                │
│ Engines              │                                      │                │
│ [Blend] [Invented]   │                                      │                │
│ [Metaphor] [Phonic]  │                                      │                │
│                      │                                      │                │
│ Banned words         │                                      │                │
│ ┌──────────────────┐ │                                      │                │
│ └──────────────────┘ │                                      │                │
│                      │                                      │                │
│ [Generate names]     │                                      │                │
└──────────────────────┴──────────────────────────────────────┴────────────────┘
```

권장 비율:

- 좌측 `Brand Brief`: 320px 고정, 최소 280px
- 중앙 `Naming Studio`: 남는 영역 전체, 최소 560px
- 우측 `Picks`: 320px 고정, 최소 280px

전체 높이:

- `100vh`
- 상단 바 56px
- 본문은 독립 스크롤

## 4. 좌측 패널: Brand Brief

목적:

- 사용자가 AI에게 넘길 브랜드 브리프를 빠르게 구성한다.
- 긴 설문처럼 보이지 않게 필드를 압축한다.

### 4.1 필드 순서

1. Category
   - SaaS / Web App
   - Mobile App
   - Company
   - Product
   - Creator Channel
   - Newsletter
   - Community
   - Store
   - Other

2. One-line brief
   - 예: “An AI tool that helps solo founders create global brand names.”
   - 120자 내외 권장

3. Keywords
   - 최대 5개
   - 칩 형태
   - Enter로 추가

4. Audience
   - 선택 입력
   - placeholder: “solo founders, creators, indie makers”

5. Tone
   - 다중 선택 칩
   - Modern, Trustworthy, Warm, Premium, Playful, Technical, Minimal, Bold

6. Creativity
   - 5단 슬라이더
   - 기본값 3

7. Language
   - English first
   - English + Korean
   - Korean, global-friendly
   - Open mix

8. Naming engines
   - Blend
   - Invented
   - Metaphor
   - Descriptive
   - Benefit-led
   - Persona-led
   - Phonetic
   - Story

9. Must include
   - 선택 입력

10. Banned words
    - 콤마 입력

11. Generate names
    - 메인 버튼
    - 생성 중 비활성화
    - 쿨다운 중 남은 초 표시

### 4.2 좌측 패널 상태

기본:

- 필수 필드가 부족하면 버튼 비활성화
- 필수 필드: Category, One-line brief, Language

생성 중:

- 입력 필드는 유지
- 버튼은 “Thinking...”으로 변경
- 패널 상단에 “One request at a time” 작은 상태 표시

쿨다운:

- 버튼: “Ready in 12s”
- 전체 앱 사용은 가능

## 5. 중앙 영역: Naming Studio

목적:

- 후보를 빠르게 스캔하고, 마음에 드는 방향을 반복적으로 좁힌다.

### 5.1 상단 액션 바

```text
┌────────────────────────────────────────────────────┐
│ Generate names                                     │
│ 12 candidates · English-first · Creativity 3       │
│                                                    │
│ [Recommended] [Short] [Invented] [Global-fit]      │
└────────────────────────────────────────────────────┘
```

구성:

- 현재 생성 설정 요약
- 정렬/필터 칩
- “Use picked style” 토글

정렬:

- Recommended
- Memorability
- Pronunciation
- Distinctiveness
- Shortest
- Most global

### 5.2 빈 상태

```text
┌──────────────────────────────────────────────┐
│ Start with a short brief.                    │
│                                              │
│ Try: “A privacy-first note app for makers.”  │
│                                              │
│ [Use sample brief]                           │
└──────────────────────────────────────────────┘
```

빈 상태에서는 긴 설명을 피하고 샘플 입력만 제공한다.

### 5.3 생성 중 상태

```text
┌──────────────────────────────────────────────┐
│ Shaping naming directions                    │
│ Refining sound and memorability              │
│ Filtering weak or generic names              │
└──────────────────────────────────────────────┘
```

애니메이션:

- 후보 카드 자리에서 글자 조합이 1~2초 흐른다.
- 실제 응답이 늦어도 과한 로딩 연출은 하지 않는다.
- 8초 이상 걸리면 “Still working. Gemini can be slower on free tier.” 표시

### 5.4 결과 상태

- 후보 카드 12개 표시
- 첫 화면에는 3~4개 카드가 보이게 카드 높이를 제한한다.
- 각 카드 우측 액션은 아이콘 버튼 중심

카드 액션:

- Pick
- More like this
- Shorter
- More premium
- More playful
- Global check
- Ban word

### 5.5 오류 상태

429 rate limit:

```text
Gemini is asking us to slow down.
Try again in a moment. Your current picks are safe.
```

서버 오류:

```text
Something failed while generating names.
You can retry or continue with saved candidates.
```

## 6. 우측 패널: Picks

목적:

- 저장한 후보를 기준으로 취향을 잡고 최종 비교한다.

### 6.1 상단 임시 픽

```text
Picks
3 selected

┌───────────────┐
│ Lumora    ×   │
│ Invented      │
└───────────────┘
```

동작:

- 최대 7개 저장
- 5개 이상이면 비교 추천 표시
- 드래그 정렬 가능

### 6.2 Preference Insight

AI 호출 없이 클라이언트에서 계산 가능한 취향 요약을 우선 제공한다.

예:

- Short names
- Soft vowel endings
- Invented + metaphorical
- English-first

이 요약은 다음 생성 프롬프트에 포함한다.

### 6.3 Compare

버튼:

- 2개 이상 픽이 있을 때 활성화
- 클릭 시 중앙 영역을 비교 모드로 전환하거나 모달을 연다.

비교 모드:

```text
┌─────────┬────────┬──────────────┬──────────┬──────────┐
│ Name    │ Sound  │ Memorability │ Global   │ Risk     │
├─────────┼────────┼──────────────┼──────────┼──────────┤
│ Lumora  │ 92     │ 88           │ Strong   │ Low      │
│ Nuvio   │ 89     │ 84           │ Strong   │ Medium   │
└─────────┴────────┴──────────────┴──────────┴──────────┘
```

### 6.4 Projects

MVP는 로컬 저장:

- 프로젝트 목록
- 새 프로젝트
- 이름 변경
- 삭제
- Export
- Import

여러 컴퓨터 사용 보완:

- `.json` 프로젝트 내보내기
- `.json` 프로젝트 가져오기

## 7. 모바일 레이아웃

모바일은 3열을 유지하지 않는다.

```text
┌────────────────────────────┐
│ BaroName        Picks (3)  │
├────────────────────────────┤
│ [Brief] [Studio] [Compare] │
├────────────────────────────┤
│                            │
│ Active tab content         │
│                            │
├────────────────────────────┤
│ [Generate]        Ready    │
└────────────────────────────┘
```

모바일 탭:

- Brief
- Studio
- Picks

하단 고정 바:

- Generate 버튼
- Picks 개수
- API 상태

모바일에서 우선순위:

1. Brief 입력
2. Generate
3. Studio에서 Pick
4. Picks에서 Compare

## 8. 주요 모달과 패널

### 8.1 Settings

- Session timeout
- Change app password 안내
- Gemini model name
- Cooldown seconds
- Export all projects
- Clear local data

MVP에서는 대부분 환경변수 기반이므로 Settings는 읽기 중심으로 시작해도 된다.

### 8.2 Candidate Detail

후보 카드를 클릭하면 우측 또는 모달로 상세 분석을 연다.

내용:

- Name
- Pronunciation
- Meaning
- Why it fits
- Global notes
- Risks
- Tagline ideas
- More variants

### 8.3 Import/Export

- Export current project
- Export all projects
- Import project JSON
- 중복 프로젝트명 처리

## 9. 접근성과 키보드

키보드:

- `Cmd/Ctrl + Enter`: Generate
- `P`: focused candidate Pick
- `M`: More like this
- `/`: brief 검색 또는 첫 입력으로 이동
- `Esc`: 모달 닫기

접근성:

- 모든 아이콘 버튼에 툴팁과 aria-label 제공
- 점수는 색상만으로 표현하지 않는다.
- 로딩 상태는 텍스트로도 표시한다.
- 카드 액션은 키보드 포커스 가능해야 한다.

## 10. 구현 메모

권장 컴포넌트:

- `PasswordGate`
- `AppShell`
- `TopBar`
- `BriefPanel`
- `CreativitySlider`
- `EngineSelector`
- `GenerationToolbar`
- `CandidateList`
- `CandidateCard`
- `PicksPanel`
- `CompareView`
- `ProjectManager`
- `ExportImportDialog`
- `RateLimitNotice`

