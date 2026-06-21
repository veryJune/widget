import { NextRequest, NextResponse } from "next/server";
import type { GenerationPayload, GenerationResponse } from "@/lib/types";
import { isValidSession } from "@/lib/auth";
import {
  callGeminiJson,
  getCached,
  hashPayload,
  normalizeGenerationResponse,
  runExclusive,
  setCached
} from "@/lib/gemini";
import { buildGenerationPrompt, temperatureFromSettings } from "@/lib/prompts";
import { generationResponseSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  if (!isValidSession(request.cookies.get("baroname_session")?.value)) {
    return NextResponse.json({ message: "Unlock BaroName first." }, { status: 401 });
  }

  const payload = (await request.json()) as GenerationPayload;
  const key = hashPayload({ type: "generate", payload });
  const cached = getCached<GenerationResponse>(key);

  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  try {
    const data = await runExclusive(async () => {
      const response = await callGeminiJson<GenerationResponse>({
        prompt: buildGenerationPrompt(payload),
        schema: generationResponseSchema,
        temperature: temperatureFromSettings(payload.settings)
      });
      return normalizeGenerationResponse(response, payload.brief.bannedWords);
    });

    setCached(key, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("BaroName generate failed", error);
    const message = error instanceof Error ? error.message : "Name generation failed.";
    const status = error instanceof Error && error.name === "RateLimitError" ? 429 : 500;
    return NextResponse.json({ message }, { status });
  }
}
