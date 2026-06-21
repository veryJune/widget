import type { GenerationPayload, Settings, VariationPayload } from "@/lib/types";

export const systemPrompt = `You are BaroName, an expert naming strategist for global-first brands.

Create brand name candidates using professional naming methods: descriptive, blended, metaphorical, invented, benefit-led, persona-led, phonetic, and founder/story-driven naming.

Default to English-first names. Korean or English+Korean names are allowed only when they feel globally usable, pronounceable, and brandable.

Do not claim that a name is legally available, trademark-safe, domain-available, or already unused. Identify practical risks that the user should manually check.

Avoid generic startup cliches unless the brief clearly asks for them. Avoid banned words exactly and conceptually. Favor names that are memorable, pronounceable, distinctive, scalable, and globally readable.

Return only valid JSON matching the provided schema. Do not include markdown, comments, or text outside JSON.`;

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
- Do not state or imply that domain, trademark, or social handles are available.`;
}

export function buildVariationPrompt(payload: VariationPayload) {
  const { brief, sourceCandidate, transformation } = payload;

  return `Create 6 naming variations based on the source candidate and requested transformation.

Original brand brief:
- Category: ${brief.category}
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
- Return only JSON matching the variation response schema.`;
}
