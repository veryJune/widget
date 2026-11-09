// Steal Book — Supabase 무료 프로젝트 자동 깨우기
//
// Supabase 무료 플랜은 7일 동안 요청이 없으면 프로젝트를 일시정지합니다.
// vercel.json 의 crons 설정으로 Vercel이 하루 한 번 이 함수를 부르고,
// 이 함수는 데이터베이스에 아주 가벼운 조회를 한 번 보냅니다.
// (로그인 없이 보내는 요청이라 보안 규칙(RLS) 때문에 결과는 항상 빈 목록입니다.)

import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_KEY;
  if (!url || !key) {
    res.end(JSON.stringify({ ok: false, reason: 'Supabase 환경변수가 없습니다.' }));
    return;
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/categories?select=id&limit=1`, {
      headers: { apikey: key },
    });
    res.end(JSON.stringify({ ok: r.ok, status: r.status, at: new Date().toISOString() }));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ ok: false, reason: String((e as Error)?.message || e) }));
  }
}
