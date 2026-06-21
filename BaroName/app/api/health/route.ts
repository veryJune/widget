import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: true,
    unlocked: isValidSession(request.cookies.get("baroname_session")?.value),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash"
  });
}
