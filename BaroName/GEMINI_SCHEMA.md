# Gemini JSON Schema

작성일: 2026-06-21

## 1. 목적

BaroName은 Gemini 응답을 자유 텍스트로 받지 않고 구조화된 JSON으로 받는다. 이렇게 해야 후보 카드, 비교표, 저장 데이터, 변주 액션을 안정적으로 구성할 수 있다.

공식 문서 기준으로 Gemini는 `responseFormat` 또는 `response_format`에서 JSON Schema 기반 structured output을 지원한다. JavaScript에서는 Zod 스키마를 만들고 `zod-to-json-schema`로 변환하는 방식이 적합하다.

참고:

- https://ai.google.dev/gemini-api/docs/structured-output

## 2. 생성 요청 입력 데이터

앱에서 서버 API로 보내는 입력 형태다.

```json
{
  "projectId": "local_project_001",
  "mode": "generate",
  "brief": {
    "category": "SaaS / Web App",
    "oneLineDescription": "An AI tool that helps solo founders create global brand names.",
    "keywords": ["naming", "brand", "global"],
    "audience": "solo founders, indie makers, creators",
    "desiredTone": ["Modern", "Trustworthy", "Minimal"],
    "avoidTone": ["childish", "corporate jargon"],
    "mustInclude": [],
    "bannedWords": ["craft", "labs"]
  },
  "settings": {
    "languageMode": "english_first",
    "creativityLevel": 3,
    "techniques": ["blend", "invented", "metaphor", "phonetic"],
    "resultCount": 12,
    "nameLengthPreference": "short_to_medium",
    "globalMode": true
  },
  "pickedContext": {
    "pickedNames": ["Lumora", "Nuvio"],
    "preferenceSummary": "Short invented English names with soft vowel endings."
  }
}
```

## 3. TypeScript/Zod 스키마 초안

구현 시 이 스키마를 기준으로 Gemini 응답을 검증한다.

```ts
import { z } from "zod";

export const TechniqueSchema = z.enum([
  "descriptive",
  "blend",
  "metaphor",
  "invented",
  "benefit_led",
  "persona_led",
  "phonetic",
  "story"
]);

export const LanguageSchema = z.enum([
  "english",
  "english_korean",
  "korean",
  "open_mix"
]);

export const GlobalFitSchema = z.enum([
  "strong",
  "good",
  "caution",
  "weak"
]);

export const RiskLevelSchema = z.enum([
  "low",
  "medium",
  "high"
]);

export const CandidateSchema = z.object({
  idHint: z.string().describe("A short stable slug-like hint for client-side ID generation."),
  name: z.string().min(1).max(40),
  displayName: z.string().min(1).max(40),
  pronunciation: z.string().min(1).max(80),
  language: LanguageSchema,
  techniques: z.array(TechniqueSchema).min(1).max(3),
  globalFit: GlobalFitSchema,
  positioning: z.string().min(20).max(160),
  rationale: z.string().min(40).max(360),
  soundProfile: z.object({
    syllables: z.number().int().min(1).max(8),
    rhythm: z.string().max(120),
    mouthfeel: z.string().max(120)
  }),
  scores: z.object({
    memorability: z.number().int().min(0).max(100),
    pronunciation: z.number().int().min(0).max(100),
    distinctiveness: z.number().int().min(0).max(100),
    scalability: z.number().int().min(0).max(100),
    globalReadiness: z.number().int().min(0).max(100)
  }),
  risks: z.array(z.object({
    level: RiskLevelSchema,
    label: z.string().max(80),
    note: z.string().max(180)
  })).min(1).max(4),
  bestFor: z.array(z.string().max(80)).min(1).max(4),
  avoidIf: z.array(z.string().max(120)).max(3),
  taglineSeeds: z.array(z.string().max(90)).min(1).max(3),
  variants: z.array(z.string().max(40)).min(2).max(5),
  recommendedTransformations: z.array(z.enum([
    "more_like_this",
    "shorter",
    "more_premium",
    "more_playful",
    "more_minimal",
    "english_only",
    "korean_friendly",
    "more_invented",
    "more_descriptive"
  ])).min(2).max(5)
});

export const NamingGenerationResponseSchema = z.object({
  briefSummary: z.string().min(40).max(300),
  strategy: z.object({
    primaryDirection: z.string().max(160),
    languageGuidance: z.string().max(160),
    creativityInterpretation: z.string().max(160)
  }),
  candidates: z.array(CandidateSchema).length(12),
  sessionInsight: z.string().max(240),
  suggestedNextActions: z.array(z.string().max(120)).min(2).max(5)
});
```

## 4. JSON Schema 초안

Gemini structured output에 넘길 수 있는 JSON Schema 형태의 초안이다. 실제 구현에서는 Zod에서 변환한다.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["briefSummary", "strategy", "candidates", "sessionInsight", "suggestedNextActions"],
  "properties": {
    "briefSummary": {
      "type": "string",
      "description": "A concise English summary of the user's naming brief."
    },
    "strategy": {
      "type": "object",
      "additionalProperties": false,
      "required": ["primaryDirection", "languageGuidance", "creativityInterpretation"],
      "properties": {
        "primaryDirection": { "type": "string" },
        "languageGuidance": { "type": "string" },
        "creativityInterpretation": { "type": "string" }
      }
    },
    "candidates": {
      "type": "array",
      "minItems": 12,
      "maxItems": 12,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "idHint",
          "name",
          "displayName",
          "pronunciation",
          "language",
          "techniques",
          "globalFit",
          "positioning",
          "rationale",
          "soundProfile",
          "scores",
          "risks",
          "bestFor",
          "avoidIf",
          "taglineSeeds",
          "variants",
          "recommendedTransformations"
        ],
        "properties": {
          "idHint": { "type": "string" },
          "name": { "type": "string" },
          "displayName": { "type": "string" },
          "pronunciation": { "type": "string" },
          "language": {
            "type": "string",
            "enum": ["english", "english_korean", "korean", "open_mix"]
          },
          "techniques": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
              "type": "string",
              "enum": [
                "descriptive",
                "blend",
                "metaphor",
                "invented",
                "benefit_led",
                "persona_led",
                "phonetic",
                "story"
              ]
            }
          },
          "globalFit": {
            "type": "string",
            "enum": ["strong", "good", "caution", "weak"]
          },
          "positioning": { "type": "string" },
          "rationale": { "type": "string" },
          "soundProfile": {
            "type": "object",
            "additionalProperties": false,
            "required": ["syllables", "rhythm", "mouthfeel"],
            "properties": {
              "syllables": { "type": "integer" },
              "rhythm": { "type": "string" },
              "mouthfeel": { "type": "string" }
            }
          },
          "scores": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "memorability",
              "pronunciation",
              "distinctiveness",
              "scalability",
              "globalReadiness"
            ],
            "properties": {
              "memorability": { "type": "integer" },
              "pronunciation": { "type": "integer" },
              "distinctiveness": { "type": "integer" },
              "scalability": { "type": "integer" },
              "globalReadiness": { "type": "integer" }
            }
          },
          "risks": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["level", "label", "note"],
              "properties": {
                "level": { "type": "string", "enum": ["low", "medium", "high"] },
                "label": { "type": "string" },
                "note": { "type": "string" }
              }
            }
          },
          "bestFor": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "items": { "type": "string" }
          },
          "avoidIf": {
            "type": "array",
            "maxItems": 3,
            "items": { "type": "string" }
          },
          "taglineSeeds": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": { "type": "string" }
          },
          "variants": {
            "type": "array",
            "minItems": 2,
            "maxItems": 5,
            "items": { "type": "string" }
          },
          "recommendedTransformations": {
            "type": "array",
            "minItems": 2,
            "maxItems": 5,
            "items": {
              "type": "string",
              "enum": [
                "more_like_this",
                "shorter",
                "more_premium",
                "more_playful",
                "more_minimal",
                "english_only",
                "korean_friendly",
                "more_invented",
                "more_descriptive"
              ]
            }
          }
        }
      }
    },
    "sessionInsight": { "type": "string" },
    "suggestedNextActions": {
      "type": "array",
      "minItems": 2,
      "maxItems": 5,
      "items": { "type": "string" }
    }
  }
}
```

## 5. 변주 응답 스키마

후보 하나에서 “More like this”, “Shorter” 같은 액션을 실행할 때 사용한다. 무료 티어 보호를 위해 6개만 생성한다.

```ts
export const NamingVariationResponseSchema = z.object({
  sourceName: z.string(),
  transformation: z.enum([
    "more_like_this",
    "shorter",
    "more_premium",
    "more_playful",
    "more_minimal",
    "english_only",
    "korean_friendly",
    "more_invented",
    "more_descriptive"
  ]),
  candidates: z.array(CandidateSchema).length(6),
  variationInsight: z.string().max(240)
});
```

## 6. 서버 검증 규칙

Gemini 응답을 받은 뒤 서버에서 추가 검증한다.

- 후보 수가 12개가 아니면 재요청하지 말고 유효 후보만 보여주며 경고한다.
- `name`이 금지어를 포함하면 제거한다.
- 같은 이름이 중복되면 하나만 남긴다.
- 이름 길이가 40자를 넘으면 제거한다.
- 점수는 0~100 범위로 clamp한다.
- 리스크가 없으면 기본 리스크 `Trademark/domain check needed`를 추가한다.

## 7. 클라이언트 저장 모델

로컬 저장용 모델은 Gemini 응답에 앱 상태를 더한다.

```ts
type StoredCandidate = Candidate & {
  id: string;
  createdAt: string;
  source: "generation" | "variation" | "import";
  isPicked: boolean;
  notes: string;
};
```

