const { neon } = require("@neondatabase/serverless");
const { getUserId, isAuthenticated, readJsonBody } = require("./_lib/session");

let sqlClient = null;
const BLOB_BACKUP_LIMIT = 12;

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

async function ensureSchema(sql) {
  await sql`
    create table if not exists promptbuilder_data (
      user_id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists promptbuilder_backup_meta (
      user_id text primary key,
      last_blob_backup_at timestamptz,
      last_blob_url text
    )
  `;
}

function summarizeBlob(blob) {
  return {
    url: blob.url,
    pathname: blob.pathname,
    size: blob.size || 0,
    uploadedAt: blob.uploadedAt || blob.createdAt || null,
  };
}

async function readBlobText(blob) {
  if (typeof blob.text === "function") return blob.text();
  const stream = blob.body || blob.readableStream;
  if (!stream) throw new Error("Blob response has no body");
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function createBlobBackup({ sql, userId, data, put, list, del }) {
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    throw new Error("Invalid backup data");
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathname = `promptbuilder/backups/${userId}/promptbuilder-${stamp}.json`;
  const blob = await put(pathname, JSON.stringify(data, null, 2), {
    access: "private",
    contentType: "application/json; charset=utf-8",
  });
  await sql`
    insert into promptbuilder_backup_meta (user_id, last_blob_backup_at, last_blob_url)
    values (${userId}, now(), ${blob.url})
    on conflict (user_id)
    do update set last_blob_backup_at = excluded.last_blob_backup_at, last_blob_url = excluded.last_blob_url
  `;
  await pruneBlobBackups({ userId, list, del });
  return blob;
}

async function pruneBlobBackups({ userId, list, del }) {
  const result = await list({
    prefix: `promptbuilder/backups/${userId}/`,
    limit: 100,
  });
  const sorted = (result.blobs || [])
    .map(summarizeBlob)
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  const oldBackups = sorted.slice(BLOB_BACKUP_LIMIT);
  if (oldBackups.length) await del(oldBackups.map((backup) => backup.url));
}

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(200).json({ configured: false, backups: [] });
    return;
  }

  try {
    const userId = getUserId();
    const { list, get, put, del } = await import("@vercel/blob");
    const sql = getSql();
    await ensureSchema(sql);

    if (req.method === "GET") {
      const result = await list({
        prefix: `promptbuilder/backups/${userId}/`,
        limit: BLOB_BACKUP_LIMIT,
      });
      const backups = (result.blobs || [])
        .map(summarizeBlob)
        .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
      res.status(200).json({ configured: true, backups });
      return;
    }

    const body = await readJsonBody(req);
    if (body.action === "create") {
      const blob = await createBlobBackup({ sql, userId, data: body.data, put, list, del });
      res.status(200).json({ ok: true, backup: summarizeBlob(blob) });
      return;
    }

    if (!body.url) {
      res.status(400).json({ error: "Missing backup url" });
      return;
    }

    const backup = await get(body.url);
    const text = await readBlobText(backup);
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
      res.status(400).json({ error: "Invalid backup data" });
      return;
    }

    const rows = await sql`
      insert into promptbuilder_data (user_id, data, updated_at)
      values (${userId}, ${JSON.stringify(data)}::jsonb, now())
      on conflict (user_id)
      do update set data = excluded.data, updated_at = now()
      returning data, updated_at
    `;

    res.status(200).json({ ok: true, data: rows[0].data, updatedAt: rows[0].updated_at });
  } catch (error) {
    res.status(500).json({
      error: "Blob backup request failed",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
