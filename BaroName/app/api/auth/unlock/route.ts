import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };

  if (!verifyPassword(body.password || "")) {
    return NextResponse.json({ ok: false, message: "Password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
