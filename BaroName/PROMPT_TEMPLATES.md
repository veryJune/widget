# Prompt Templates

작성일: 2026-06-21

## 1. 프롬프트 원칙

BaroName의 Gemini 프롬프트는 영어 이름 생성을 기본으로 한다. 사용자가 한글 또는 한영 혼합을 선택하더라도 글로벌 관점에서 자연스러운 이름만 추천한다.

원칙:

- 결과는 반드시 JSON Schema에 맞춘다.
- 후보는 12개 생성한다.
- 법적/상표 가능성을 확정적으로 말하지 않는다.
- 도메인 가능 여부를 실제 확인한 것처럼 말하지 않는다.
- 금지어와 회피 톤을 엄격히 지킨다.
- 흔한 SaaS 접미사 남발을 피한다.
- 의미, 어감, 글로벌 발음성을 함께 평가한다.

## 2. 시스템 프롬프트

```text
You are BaroName, an expert naming strategist for global-first brands.

Your job is to create brand name candidates using professional naming methods:
descriptive, blended, metaphorical, invented, benefit-led, persona-led, phonetic, and founder/story-driven naming.

Default to English-first names unless the user explicitly requests Korean or mixed names.
Korean or English+Korean names are allowed only when they still feel globally usable, pronounceable, and brandable.

Do not claim that a name is legally available, trademark-safe, domain-available, or already unused.
Instead, identify practical risks that the user should manually check.

Avoid generic startup clichés unless the brief clearly asks for them.
Avoid banned words exactly and conceptually.
Favor names that are memorable, pronounceable, distinctive, scalable, and globally readable.

Return only valid JSON matching the provided schema.
Do not include markdown, comments, or explanatory text outside JSON.
```

## 3. 생성 프롬프트

사용자가 `Generate names`를 누를 때 사용한다.

```text
Create 12 brand name candidates for the following naming brief.

Brand brief:
- Category: {{category}}
- One-line description: {{oneLineDescription}}
- Keywords: {{keywords}}
- Target audience: {{audience}}
- Desired tone: {{desiredTone}}
- Tone to avoid: {{avoidTone}}
- Must include: {{mustInclude}}
- Banned words: {{bannedWords}}

Naming settings:
- Language mode: {{languageMode}}
- Creativity level: {{creativityLevel}} out of 5
- Selected naming techniques: {{techniques}}
- Result count: 12
- Name length preference: {{nameLengthPreference}}
- Global-first evaluation: {{globalMode}}

Picked-name context:
- Picked names: {{pickedNames}}
- Preference summary: {{preferenceSummary}}

Creativity interpretation:
1 = clear and descriptive
2 = clear with light originality
3 = balanced: brandable, fresh, still understandable
4 = bold: invented, metaphorical, root-based, less literal
5 = experimental: highly distinctive, abstract, unusual sound patterns

Requirements:
- Generate exactly 12 candidates.
- Prefer English-first global names.
- Include Korean or mixed names only if they feel globally natural.
- Use the selected naming techniques, but keep quality higher than mechanical coverage.
- Each candidate must include pronunciation guidance.
- Each candidate must include at least one practical risk.
- Score each candidate from 0 to 100 for memorability, pronunciation, distinctiveness, scalability, and global readiness.
- Include 2 to 5 variants per candidate.
- Include 1 to 3 tagline seeds per candidate.
- Avoid all banned words.
- Do not include names that are obvious copies of famous brands.
- Do not state or imply that domain, trademark, or social handles are available.

Return only JSON matching the response schema.
```

## 4. 변주 프롬프트

후보 카드의 `More like this`, `Shorter`, `More premium` 같은 액션에서 사용한다.

```text
Create 6 naming variations based on the source candidate and requested transformation.

Original brand brief:
- Category: {{category}}
- One-line description: {{oneLineDescription}}
- Keywords: {{keywords}}
- Target audience: {{audience}}
- Desired tone: {{desiredTone}}
- Tone to avoid: {{avoidTone}}
- Must include: {{mustInclude}}
- Banned words: {{bannedWords}}

Source candidate:
- Name: {{sourceName}}
- Pronunciation: {{sourcePronunciation}}
- Techniques: {{sourceTechniques}}
- Positioning: {{sourcePositioning}}
- Rationale: {{sourceRationale}}
- Risks: {{sourceRisks}}

Requested transformation:
{{transformation}}

Transformation meanings:
- more_like_this: preserve the strongest qualities of the source name while making fresh alternatives.
- shorter: make names shorter, cleaner, and easier to say.
- more_premium: make names feel more refined, confident, and high-trust.
- more_playful: make names warmer, lighter, and more approachable.
- more_minimal: make names quieter, cleaner, and less decorative.
- english_only: produce English-first names only.
- korean_friendly: make names easy for Korean speakers while still globally usable.
- more_invented: make more distinctive coined names.
- more_descriptive: make the value proposition clearer.

Requirements:
- Generate exactly 6 candidates.
- Do not repeat the source name.
- Do not only change spelling by one letter unless the result is meaningfully better.
- Preserve the user's global-first preference.
- Avoid all banned words.
- Return only JSON matching the variation response schema.
```

## 5. 후보 분석 프롬프트

MVP에서는 후보 상세 분석도 기본 생성 응답에 포함한다. 그래도 나중에 상세 분석 버튼이 필요하면 아래 프롬프트를 사용한다.

```text
Analyze this brand name candidate for a global-first naming project.

Name:
{{name}}

Brand brief:
{{brief}}

Evaluate:
- pronunciation
- memorability
- likely associations
- global readability
- category fit
- scalability
- risks to manually check
- tagline directions

Important:
- Do not claim trademark, domain, or social handle availability.
- Keep the analysis practical and concise.
- Return only JSON matching the candidate analysis schema.
```

## 6. 선호 요약 프롬프트

가능하면 Gemini 호출 없이 클라이언트에서 계산한다. 저장 후보가 충분히 많고 더 고급 요약이 필요할 때만 사용한다.

```text
Summarize the user's naming preferences from these picked candidates.

Picked candidates:
{{pickedCandidates}}

Return a short preference summary useful for the next naming generation.

Focus on:
- name length
- language
- sound pattern
- naming techniques
- tone
- global style
- repeated risks to avoid

Return only JSON:
{
  "preferenceSummary": "string",
  "strongSignals": ["string"],
  "avoidNext": ["string"]
}
```

## 7. Gemini API 호출 설정 권장

권장:

- model: 구현 시점 무료 티어에서 안정적인 Flash 계열 확인
- response MIME type: `application/json`
- response schema: Zod -> JSON Schema 변환
- temperature: 창의성 강도에 따라 0.7~1.2 사이 조절
- max output tokens: 후보 12개를 감당할 만큼 설정

창의성 강도별 temperature 초안:

- 1: 0.55
- 2: 0.7
- 3: 0.85
- 4: 1.0
- 5: 1.15

## 8. 무료 티어 보호 프롬프트 전략

- 개인용 앱이므로 생성 횟수 제한은 두지 않는다.
- 한 번에 12개를 생성해 잦은 호출 없이 충분히 탐색하게 한다.
- 후보 설명은 카드에 필요한 만큼만 압축한다.
- 상세 분석은 초기 응답에 포함해 추가 호출을 줄인다.
- 변주는 6개씩 생성하되 사용자가 원하면 반복할 수 있게 한다.
- 도메인/상표 확인을 요청하지 않는다.
- Google Search grounding은 MVP에서 사용하지 않는다.
- 짧은 시간의 반복 클릭은 클라이언트에서 8초 정도만 완충한다.

## 9. 실패 대응

파싱 실패:

- 같은 요청을 즉시 반복하지 않는다.
- 서버에서 가능한 후보만 복구한다.
- 사용자에게 “Some generated items could not be used.”를 표시한다.

Rate limit:

- 429 응답이면 Gemini가 요청 속도를 늦추라고 한 상황이므로 잠시 후 재시도하게 한다.
- 자동 재시도는 하지 않는다.
- 같은 브리프의 캐시 결과가 있으면 캐시를 먼저 보여준다.
