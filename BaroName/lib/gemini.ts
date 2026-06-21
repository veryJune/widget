import crypto from "crypto";
import type { Candidate, GenerationResponse } from "@/lib/types";
import { systemPrompt } from "@/lib/prompts";

const cache = new Map<string, unknown>();
let activeRequest = false;

export function hashPayload(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getCached<T>(key: string) {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T) {
  if (cache.size > 50) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, value);
}

export async function runExclusive<T>(fn: () => Promise<T>) {
  if (activeRequest) {
    throw new Error("A naming request is already running. Please wait for it to finish.");
  }

  activeRequest = true;
  try {
    return await fn();
  } finally {
    activeRequest = false;
  }
}

export async function callGeminiJson<T>({
  prompt,
  schema,
  temperature
}: {
  prompt: string;
  schema: unknown;
  temperature: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env.local or Vercel environment variables.");
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n${prompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature,
      responseMimeType: "application/json"
    }
  };

  let raw: { text: string };
  try {
    raw = await postGemini(model, apiKey, requestBody);
  } catch (error) {
    if (!(error instanceof Error) || !isSchemaCompatibilityError(error.message)) {
      throw error;
    }

    raw = await postGemini(model, apiKey, {
      ...requestBody,
      generationConfig: {
        temperature,
        responseMimeType: "application/json"
      }
    });
  }

  const payload = parseJsonLoose(raw.text) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return parseJsonLoose(text) as T;
}

async function postGemini(model: string, apiKey: string, body: unknown) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    }
  );

  const text = await response.text();

  if (!response.ok) {
    let message = `Gemini request failed (${response.status}).`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      message = parsed.error?.message || message;
    } catch {
      if (text) {
        message = text.slice(0, 220);
      }
    }
    const error = new Error(message);
    error.name = response.status === 429 ? "RateLimitError" : "GeminiError";
    throw error;
  }

  return { text, message: "" };
}

function isSchemaCompatibilityError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid argument") ||
    normalized.includes("response_schema") ||
    normalized.includes("responseschema") ||
    normalized.includes("response_format") ||
    normalized.includes("responseformat") ||
    normalized.includes("mime_type") ||
    normalized.includes("mimetype") ||
    normalized.includes("schema")
  );
}

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const extracted = extractFirstJsonObject(text);
    if (!extracted) {
      throw new Error("Gemini returned text that was not valid JSON.");
    }
    return JSON.parse(extracted);
  }
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return "";
}

export function normalizeCandidate(candidate: Partial<Candidate>, index: number): Candidate | null {
  const name = String(candidate.name || candidate.displayName || "").trim();
  if (!name) {
    return null;
  }

  const scores = candidate.scores || {
    memorability: 70,
    pronunciation: 70,
    distinctiveness: 70,
    scalability: 70,
    globalReadiness: 70
  };

  return {
    idHint: String(candidate.idHint || name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `name-${index}`),
    name,
    displayName: String(candidate.displayName || name),
    pronunciation: String(candidate.pronunciation || "Pronunciation needs review"),
    aiTake: String(candidate.aiTake || candidate.positioning || "Balanced candidate with practical brand potential."),
    language: candidate.language || "english",
    techniques: Array.isArray(candidate.techniques) && candidate.techniques.length > 0 ? candidate.techniques : ["invented"],
    globalFit: candidate.globalFit || "good",
    positioning: String(candidate.positioning || "A global-first naming candidate for this brief."),
    rationale: String(candidate.rationale || "This candidate was generated to balance memorability, sound, and brand fit."),
    soundProfile: {
      syllables: Number(candidate.soundProfile?.syllables || 2),
      rhythm: String(candidate.soundProfile?.rhythm || "Simple rhythm"),
      mouthfeel: String(candidate.soundProfile?.mouthfeel || "Easy to say")
    },
    scores: {
      memorability: clampScore(scores.memorability),
      pronunciation: clampScore(scores.pronunciation),
      distinctiveness: clampScore(scores.distinctiveness),
      scalability: clampScore(scores.scalability),
      globalReadiness: clampScore(scores.globalReadiness)
    },
    risks:
      Array.isArray(candidate.risks) && candidate.risks.length > 0
        ? candidate.risks.slice(0, 4).map((risk) => ({
            level: risk.level || "medium",
            label: String(risk.label || "Manual check needed"),
            note: String(risk.note || "Check domain, social, and trademark conflicts before final use.")
          }))
        : [
            {
              level: "medium",
              label: "Manual check needed",
              note: "Check domain, social, and trademark conflicts before final use."
            }
          ],
    bestFor: arrayOfStrings(candidate.bestFor, ["Global-first brand"]),
    avoidIf: arrayOfStrings(candidate.avoidIf, []),
    taglineSeeds: arrayOfStrings(candidate.taglineSeeds, ["Name the next thing clearly"]),
    variants: arrayOfStrings(candidate.variants, [`${name}ly`, `${name} Studio`]).slice(0, 5),
    recommendedTransformations:
      Array.isArray(candidate.recommendedTransformations) && candidate.recommendedTransformations.length > 0
        ? candidate.recommendedTransformations.slice(0, 5)
        : ["more_like_this", "shorter", "more_premium"]
  };
}

export function normalizeGenerationResponse(response: Partial<GenerationResponse>, bannedWords: string[]) {
  const loose = response as Partial<GenerationResponse> & {
    names?: unknown[];
    nameCandidates?: unknown[];
    candidateNames?: unknown[];
    results?: unknown[];
  };
  const rawCandidates =
    response.candidates ||
    loose.names ||
    loose.nameCandidates ||
    loose.candidateNames ||
    loose.results ||
    [];

  const candidates = normalizeCandidateCollection(rawCandidates, bannedWords, 12);

  return {
    briefSummary: String(response.briefSummary || "Global-first naming sprint"),
    strategy: response.strategy || {
      primaryDirection: "Generate memorable global-first names.",
      languageGuidance: "Prefer English names unless a Korean or mixed name feels natural globally.",
      creativityInterpretation: "Balanced brandable naming."
    },
    candidates,
    sessionInsight: String(response.sessionInsight || "Pick names you like to steer the next round."),
    suggestedNextActions: response.suggestedNextActions || ["Pick strong candidates", "Try variations"]
  };
}

export function normalizeCandidateCollection(rawCandidates: unknown[], bannedWords: string[], limit: number) {
  const seen = new Set<string>();
  const banned = bannedWords.map((word) => word.trim().toLowerCase()).filter(Boolean);
  return rawCandidates
    .map((candidate, index) => normalizeCandidate(coerceLooseCandidate(candidate), index))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .filter((candidate) => {
      const key = candidate.displayName.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return !banned.some((word) => key.includes(word));
    })
    .slice(0, limit);
}

function coerceLooseCandidate(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") {
    return {};
  }

  const item = candidate as Record<string, unknown>;
  const scores = (item.scores || item.score || {}) as Record<string, unknown>;

  return {
    ...item,
    name: item.name || item.title || item.brandName || item.candidate || item.value,
    displayName: item.displayName || item.name || item.title || item.brandName || item.candidate || item.value,
    aiTake: item.aiTake || item.evaluation || item.verdict || item.review || item.quickTake || item.summary,
    positioning: item.positioning || item.summary || item.description || item.tagline,
    rationale: item.rationale || item.reason || item.explanation || item.meaning,
    pronunciation: item.pronunciation || item.pronunciationGuide || item.sound,
    globalFit: item.globalFit || item.global_fit || "good",
    scores: {
      memorability: scores.memorability || scores.memory || scores.memorable || 70,
      pronunciation: scores.pronunciation || scores.sound || scores.speakability || 70,
      distinctiveness: scores.distinctiveness || scores.distinct || scores.uniqueness || 70,
      scalability: scores.scalability || scores.expandability || scores.expand || 70,
      globalReadiness: scores.globalReadiness || scores.global || scores.globalFit || 70
    }
  };
}

function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 70;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function arrayOfStrings(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const cleaned = value.map((item) => String(item).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : fallback;
}
