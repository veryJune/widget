import { NextRequest, NextResponse } from "next/server";
import type { Candidate, VariationPayload } from "@/lib/types";
import { isValidSession } from "@/lib/auth";
import { callGeminiJson, normalizeCandidate, runExclusive } from "@/lib/gemini";
import { buildVariationPrompt, temperatureFromSettings } from "@/lib/prompts";
import { variationResponseSchema } from "@/lib/schemas";

type VariationResponse = {
  sourceName: string;
  transformation: string;
  candidates: Candidate[];
  variationInsight: string;
};

export async function POST(request: NextRequest) {
  if (!isValidSession(request.cookies.get("baroname_session")?.value)) {
    return NextResponse.json({ message: "Unlock BaroName first." }, { status: 401 });
  }

  const payload = (await request.json()) as VariationPayload;

  try {
    const data = await runExclusive(async () => {
      const response = await callGeminiJson<VariationResponse>({
        prompt: buildVariationPrompt(payload),
        schema: variationResponseSchema,
        temperature: Math.min(1.2, temperatureFromSettings(payload.settings) + 0.05)
      });

      const candidates = (response.candidates || [])
        .map(normalizeCandidate)
        .filter((candidate): candidate is Candidate => Boolean(candidate))
        .slice(0, 6);

      if (candidates.length === 0) {
        throw new Error("Gemini responded, but BaroName could not find usable variations. Try another refinement.");
      }

      return {
        ...response,
        candidates
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("BaroName variation failed", error);
    const message = error instanceof Error ? error.message : "Name variation failed.";
    const status = error instanceof Error && error.name === "RateLimitError" ? 429 : 500;
    return NextResponse.json({ message }, { status });
  }
}
