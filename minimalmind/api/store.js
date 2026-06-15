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
    if (!expected) { res.status(500).json({ error: 'APP_PASSWORD not configured' }); return; }

    const key = req.headers['x-mm-key'];
    if (!key || key !== expected) { res.status(401).json({ error: 'unauthorized' }); return; }

    try {
        if (req.method === 'GET') {
            const { blobs } = await list({ prefix: PATH });
            const found = blobs.find(b => b.pathname === PATH);
            if (!found) { res.status(200).json({ empty: true }); return; }
            const r = await fetch(found.url, { cache: 'no-store' });
            if (!r.ok) { res.status(200).json({ empty: true }); return; }
            const data = await r.json();
            res.status(200).json({ data });
            return;
        }

        if (req.method === 'PUT' || req.method === 'POST') {
            const payload = readJsonBody(req);
            if (!payload || typeof payload !== 'object') { res.status(400).json({ error: 'invalid body' }); return; }
            await put(PATH, JSON.stringify(payload), {
                access: 'public',           // URL 은 랜덤 store-id 하위라 추측 불가, 클라이언트엔 노출 안 됨
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
