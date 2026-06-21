# Candidate Card UI Spec

작성일: 2026-06-21

## 1. 역할

후보 카드는 BaroName의 핵심 UI다. 사용자는 카드에서 이름의 첫인상을 보고, 저장할지, 변주할지, 제외할지 결정한다.

카드는 다음 질문에 빠르게 답해야 한다.

- 이 이름이 무엇인가?
- 글로벌 관점에서 자연스러운가?
- 왜 추천됐는가?
- 어떤 리스크가 있는가?
- 다음 액션은 무엇인가?

## 2. 카드 기본 구조

```text
┌──────────────────────────────────────────────────────────┐
│ Invented · English · Global fit: Strong          ☆  ⋯    │
│                                                          │
│ Lumora                                                   │
│ Loo-MOR-ah                                               │
│                                                          │
│ A warm, luminous invented name for a modern AI workspace.│
│                                                          │
│ Memory 88   Sound 92   Distinct 81   Expand 84           │
│                                                          │
│ Risk: Similar soft-tech names may exist.                  │
│                                                          │
│ [More like this] [Shorter] [Premium] [Ban word]           │
└──────────────────────────────────────────────────────────┘
```

## 3. 정보 우선순위

1. 후보 이름
2. 발음
3. 글로벌 적합성
4. 한 줄 포지셔닝
5. 점수
6. 리스크
7. 액션

후보 이름은 카드에서 가장 큰 시각적 요소여야 한다.

## 4. 필드 상세

### 4.1 Technique Badge

위치:

- 카드 상단 좌측

표시:

- `Invented`
- `Blend`
- `Metaphor`
- `Descriptive`
- `Benefit-led`
- `Persona-led`
- `Phonetic`
- `Story`

복수 기법이면 대표 기법 1개와 `+1`로 표시한다.

예:

- `Invented +1`

### 4.2 Language Badge

표시:

- English
- English + Korean
- Korean
- Open mix

MVP 기본값:

- English

### 4.3 Global Fit

표시:

- Strong
- Good
- Caution
- Weak

색상:

- Strong: green
- Good: blue
- Caution: amber
- Weak: red

주의:

- 색상만으로 상태를 전달하지 않고 텍스트를 같이 표시한다.

### 4.4 Name

스타일:

- 28~34px
- font-weight 650~750
- letter-spacing 0
- 한 줄 우선
- 너무 길면 2줄 허용

규칙:

- 영어 후보는 Title Case 또는 브랜드 표기 그대로 표시
- 한글 후보는 원문 그대로 표시
- 혼합 후보는 `BaroName`처럼 권장 표기를 표시

### 4.5 Pronunciation

영어 후보:

- 간단한 음절 표기
- 예: `LOO-mor-ah`

한글 후보:

- 로마자 또는 영어권 발음 힌트
- 예: `ba-ro-name`

표시하지 못할 경우:

- `Pronunciation needs review`

### 4.6 Positioning

한 줄 설명:

- 80~120자
- 마케팅 카피가 아니라 “어떤 브랜드로 보이는지” 설명

예:

- `A clean, global-friendly name for an AI naming workspace.`

### 4.7 Scores

점수 항목:

- Memory
- Sound
- Distinct
- Expand
- Global

각 점수:

- 0~100 정수
- 70 이상 기본 추천 가능
- 60 미만이면 카드에 caution 표시

표시 방식:

```text
Memory 88 | Sound 92 | Global 85
```

상세 점수는 카드 펼침 또는 디테일 패널에서 보여준다.

### 4.8 Risk

리스크는 반드시 표시한다.

유형:

- Too generic
- Similar names likely
- Hard to pronounce
- Meaning unclear
- Korean-only feel
- Possible negative association
- Trademark/domain check needed

문구 원칙:

- 법적 판단처럼 쓰지 않는다.
- “확인 필요”로 표현한다.

예:

- `Risk: Check similar soft-tech brand names before final use.`

### 4.9 Actions

기본 액션:

- Pick
- More like this
- Shorter
- More premium
- Ban word

보조 액션:

- More playful
- More minimal
- Make Korean-friendly
- Make English-only
- Copy

아이콘 권장:

- Pick: star
- More like this: refresh
- Shorter: scissors 또는 shrink
- Premium: gem
- Ban word: ban
- Copy: copy

모든 아이콘에는 툴팁을 붙인다.

## 5. 카드 상태

### 5.1 Default

- 흰색 배경
- 얇은 보더
- hover 시 보더와 그림자만 살짝 강조

### 5.2 Picked

- 상단 별 아이콘 채움
- 좌측 또는 상단에 얇은 accent line
- 우측 Picks 패널과 동일한 색상 사용

### 5.3 Focused

- 키보드 포커스 링 표시
- 액션 버튼이 명확히 보임

### 5.4 Loading Placeholder

```text
┌──────────────────────────────────────────┐
│ Shaping sound...                         │
│ N_ _ _ a                                 │
│ Filtering generic options                │
└──────────────────────────────────────────┘
```

### 5.5 Error

후보 하나만 파싱 실패한 경우:

- 해당 후보를 숨기고 전체 결과 상단에 “Some weak items were removed.” 표시

## 6. 카드 상세 패널

카드 클릭 시 상세 패널을 연다.

구성:

```text
Lumora
LOO-mor-ah

Why it works
...

Name anatomy
- Root/association
- Sound profile
- Visual feel

Global notes
...

Risks to check
...

Possible taglines
...

[Pick] [More like this] [Copy]
```

상세 패널은 추가 Gemini 호출 없이 초기 응답 데이터로 우선 구성한다. 태그라인을 더 만들 때만 추가 호출한다.

## 7. 카드 반응형

데스크톱:

- 카드 폭은 중앙 영역 전체
- 액션 버튼은 한 줄 또는 두 줄

태블릿:

- 점수는 3개만 노출하고 상세에서 전체 표시

모바일:

- 후보 이름, 발음, 포지셔닝, Pick 버튼 우선
- 점수는 접힌 형태
- 액션은 하단 메뉴로 이동

## 8. 데이터 매핑

카드 UI 필드와 Gemini 응답 필드 매핑:

- `name` -> 후보 이름
- `pronunciation` -> 발음
- `language` -> 언어 배지
- `techniques` -> 기법 배지
- `globalFit` -> 글로벌 적합성
- `positioning` -> 한 줄 포지셔닝
- `rationale` -> 상세 설명
- `scores` -> 점수
- `risks` -> 리스크
- `actions.availableTransformations` -> 추천 변주 액션

