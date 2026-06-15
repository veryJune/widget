// MinimalMind — 클라우드 저장 API (Vercel Blob + 단일 비밀번호)
//
// 필요한 환경변수 (Vercel 프로젝트 Settings → Environment Variables):
//   APP_PASSWORD            : 동기화 비밀번호 (직접 정함)
//   BLOB_READ_WRITE_TOKEN   : Blob 저장소 생성 시 자동 추가됨
//
// 데이터는 비공개 경로의 단일 JSON Blob 으로 저장되고, 이 함수만이
// (서버측에서) 접근합니다. 클라이언트는 비밀번호로만 인증합니다.

import { put, list } from '@vercel/blob';

const PATH = 'mm-store.json';

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string' && req.body.length) {
        try { return JSON.parse(req.body); } catch (e) { return null; }
    }
    return null;
}

export default async function handler(req, res) {
    const expected = process.env.APP_PASSWORD;
    if (!expected) { res.status(500).json({ error: 'APP_PASSWORD 환경변수가 설정되지 않았습니다.' }); return; }

    const key = req.headers['x-mm-key'];
    if (!key || key !== expected) { res.status(401).json({ error: 'unauthorized' }); return; }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN 이 없습니다. Vercel에서 Blob 저장소를 프로젝트에 연결(Connect)하세요.' });
        return;
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    try {
        if (req.method === 'GET') {
            const { blobs } = await list({ prefix: PATH });
            const found = blobs.find(b => b.pathname === PATH);
            if (!found) { res.status(200).json({ empty: true }); return; }
            // 비공개 Blob 은 토큰(Bearer)으로만 읽을 수 있음
            const r = await fetch(found.url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
            if (!r.ok) { res.status(200).json({ empty: true }); return; }
            const data = await r.json();
            res.status(200).json({ data });
            return;
        }

        if (req.method === 'PUT' || req.method === 'POST') {
            const payload = readJsonBody(req);
            if (!payload || typeof payload !== 'object') { res.status(400).json({ error: 'invalid body' }); return; }
            await put(PATH, JSON.stringify(payload), {
                access: 'private',          // 비공개 저장소: 토큰 있어야 읽기/쓰기 가능 (더 안전)
                addRandomSuffix: false,
                allowOverwrite: true,
                contentType: 'application/json',
            });
            res.status(200).json({ ok: true });
            return;
        }

        res.status(405).json({ error: 'method not allowed' });
    } catch (e) {
        res.status(500).json({ error: String((e && e.message) || e) });
    }
}
