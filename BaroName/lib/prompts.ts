import type { GenerationPayload, Settings, VariationPayload } from "@/lib/types";

export const systemPrompt = `You are BaroName, an expert naming strategist for global-first brands.

Create brand name candidates using professional naming methods: descriptive, blended, metaphorical, invented, benefit-led, persona-led, phonetic, and founder/story-driven naming.

Default to English-first brand names. The generated name itself should usually stay in English or a globally readable coined form.

Do not claim that a name is legally available, trademark-safe, domain-available, or already unused. Identify practical risks that the user should manually check.

Avoid generic startup cliches unless the brief clearly asks for them. Avoid banned words exactly and conceptually. Favor names that are memorable, pronounceable, distinctive, scalable, and globally readable.

When Korean analysis mode is requested, think like a bilingual Korean brand strategist: keep the name and useful English terms as-is, but explain why it works, risks, pronunciation help, and usage context in natural Korean. Do not awkwardly translate product UI labels or brand names. Mix English only where it helps judgment.

Return only valid JSON. Do not include markdown, comments, or text outside JSON.`;

export function temperatureFromSettings(settings: Settings) {
  const map: Record<number, number> = {
    1: 0.55,
    2: 0.7,
    3: 0.85,
    4: 1.0,
    5: 1.15
  };

  return map[Math.min(5, Math.max(1, settings.creativityLevel))] ?? 0.85;
}

export function buildGenerationPrompt(payload: GenerationPayload) {
  const { brief, settings, pickedContext } = payload;
  const responseLanguage =
    payload.uiLanguage === "ko"
      ? "Korean analysis mode. Keep brand names in English or their natural script. Write aiTake, positioning, rationale, risks, soundProfile rhythm/mouthfeel, bestFor, avoidIf, taglineSeeds, strategy, and sessionInsight in natural Korean with useful English terms left intact. The tone should feel like ChatGPT/Gemini naturally advising a Korean user about global naming candidates."
      : "English analysis mode. Write aiTake, positioning, rationale, risks, sound notes, strategy, and insights in concise natural English.";
  const nameLanguageGuidance = {
    english_first:
      "Generate mostly English or globally readable coined names. Korean names are allowed only if exceptionally natural globally.",
    english_korean:
      "Generate a balanced mix of English names, English+Korean hybrid names, and Korean-friendly global names. Set candidate language accurately.",
    korean_global:
      "Generate Korean or Korean-rooted names that can still travel globally. Romanization or pronunciation help is important. Set language to korean or english_korean.",
    open_mix:
      "Generate the strongest names regardless of script, but keep global readability. Use english, english_korean, korean, or open_mix accurately."
  }[settings.languageMode];

  return `Create 12 brand name candidates for the following naming brief.

Brand brief:
- Category: ${brief.category}
- One-line description: ${brief.oneLineDescription}
- Keywords: ${brief.keywords.join(", ") || "none"}
- Target audience: ${brief.audience || "not specified"}
- Desired tone: ${brief.desiredTone.join(", ") || "not specified"}
- Tone to avoid: ${brief.avoidTone || "not specified"}
- Must include: ${brief.mustInclude.join(", ") || "none"}
- Banned words: ${brief.bannedWords.join(", ") || "none"}

Naming settings:
- Language mode: ${settings.languageMode}
- Name language guidance: ${nameLanguageGuidance}
- UI response language: ${payload.uiLanguage || "en"}
- Response language instruction: ${responseLanguage}
- Creativity level: ${settings.creativityLevel} out of 5
- Selected naming techniques: ${settings.techniques.join(", ")}
- Result count: 12
- Name length preference: ${settings.nameLengthPreference}
- Global-first evaluation: ${settings.globalMode ? "yes" : "no"}

Picked-name context:
- Picked names: ${pickedContext.pickedNames.join(", ") || "none"}
- Preference summary: ${pickedContext.preferenceSummary || "none yet"}

Creativity interpretation:
1 = clear and descriptive
2 = clear with light originality
3 = balanced: brandable, fresh, still understandable
4 = bold: invented, metaphorical, root-based, less literal
5 = experimental: highly distinctive, abstract, unusual sound patterns

Requirements:
- Generate exactly 12 candidates.
- Follow the Name language guidance. Do not blindly mark every candidate as English.
- Use candidate.language accurately: english for English-only names, korean for Korean-only names, english_korean for mixed/dual-script names, open_mix for other global hybrids.
- Use the selected naming techniques, but keep quality higher than mechanical coverage.
- Each candidate must include pronunciation guidance.
- Each candidate must include at least one practical risk.
- Score each candidate from 0 to 100 for memorability, pronunciation, distinctiveness, scalability, and global readiness.
- Include 2 to 5 variants per candidate.
- Include 1 to 3 tagline seeds per candidate.
- Avoid all banned words.
- Do not include names that are obvious copies of famous brands.
- Do not state or imply that domain, trademark, or social handles are available.
- Follow the analysis language instruction carefully. Do not translate the brand name itself unless a Korean/mixed name is genuinely better.
- Add aiTake: one practical evaluator sentence that helps the user decide quickly.

Return this exact JSON shape:
{
  "briefSummary": "short summary",
  "strategy": {
    "primaryDirection": "strategy sentence",
    "languageGuidance": "language sentence",
    "creativityInterpretation": "creativity sentence"
  },
  "candidates": [
    {
      "idHint": "short-slug",
      "name": "Name",
      "displayName": "Name",
      "pronunciation": "simple pronunciation guide",
      "aiTake": "one practical evaluator sentence",
      "language": "english",
      "techniques": ["invented"],
      "globalFit": "strong",
      "positioning": "one-line positioning",
      "rationale": "why this name fits",
      "soundProfile": {
        "syllables": 2,
        "rhythm": "short rhythm note",
        "mouthfeel": "mouthfeel note"
      },
      "scores": {
        "memorability": 80,
        "pronunciation": 80,
        "distinctiveness": 80,
        "scalability": 80,
        "globalReadiness": 80
      },
      "risks": [
        {
          "level": "medium",
          "label": "Manual check needed",
          "note": "Check domain, social, and trademark conflicts before final use."
        }
      ],
      "bestFor": ["best use"],
      "avoidIf": ["avoid condition"],
      "taglineSeeds": ["tagline seed"],
      "variants": ["Variant"],
      "recommendedTransformations": ["more_like_this", "shorter", "more_premium"]
    }
  ],
  "sessionInsight": "short insight",
  "suggestedNextActions": ["next action"]
}`;
}

export function buildVariationPrompt(payload: VariationPayload) {
  const { brief, sourceCandidate, transformation } = payload;
  const responseLanguage =
    payload.uiLanguage === "ko"
      ? "Korean analysis mode. Keep brand names natural, usually English, but write aiTake, positioning, rationale, risks, sound notes, and insight in natural Korean with useful English terms left intact."
      : "English UI mode. Write explanations, risks, sound notes, and insight in concise natural English.";

  return `Create 6 naming variations based on the source candidate and requested transformation.

Original brand brief:
- Category: ${brief.category}
- UI response language: ${payload.uiLanguage || "en"}
- Response language instruction: ${responseLanguage}
- One-line description: ${brief.oneLineDescription}
- Keywords: ${brief.keywords.join(", ") || "none"}
- Target audience: ${brief.audience || "not specified"}
- Desired tone: ${brief.desiredTone.join(", ") || "not specified"}
- Tone to avoid: ${brief.avoidTone || "not specified"}
- Must include: ${brief.mustInclude.join(", ") || "none"}
- Banned words: ${brief.bannedWords.join(", ") || "none"}

Source candidate:
- Name: ${sourceCandidate.displayName}
- Pronunciation: ${sourceCandidate.pronunciation}
- Techniques: ${sourceCandidate.techniques.join(", ")}
- Positioning: ${sourceCandidate.positioning}
- Rationale: ${sourceCandidate.rationale}
- Risks: ${sourceCandidate.risks.map((risk) => risk.note).join(" | ")}

Requested transformation:
${transformation}

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
- Follow the analysis language instruction. Do not translate the brand name itself unless a Korean/mixed name is genuinely better.
- Set candidate.language accurately.
- Return only JSON matching this shape:
{
  "sourceName": "source",
  "transformation": "more_like_this",
  "candidates": [],
  "variationInsight": "short insight"
}

The candidates array must use the same candidate object structure as the main generation response.`;
}
