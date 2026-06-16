const { neon } = require("@neondatabase/serverless");
const {
  getUserId,
  isAuthenticated,
  readJsonBody,
} = require("./_lib/session");

let sqlClient = null;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
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
    create table if not exists promptbuilder_snapshots (
      id bigserial primary key,
      user_id text not null,
      data jsonb not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists promptbuilder_snapshots_user_created_idx
    on promptbuilder_snapshots (user_id, created_at desc)
  `;
  await sql`
    create table if not exists promptbuilder_backup_meta (
      user_id text primary key,
      last_blob_backup_at timestamptz,
      last_blob_url text
    )
  `;
}

async function maybeRunBlobBackup(sql, userId, data) {
  if (data?.settings?.blobWeeklyBackup !== true) return { enabled: false };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { enabled: true, skipped: true, reason: "BLOB_READ_WRITE_TOKEN missing" };

  const metaRows = await sql`
    select last_blob_backup_at
    from promptbuilder_backup_meta
    where user_id = ${userId}
    limit 1
  `;
  const lastBackupAt = metaRows[0]?.last_blob_backup_at ? new Date(metaRows[0].last_blob_backup_at) : null;
  if (lastBackupAt && Date.now() - lastBackupAt.getTime() < ONE_WEEK_MS) {
    return { enabled: true, skipped: true, lastBlobBackupAt: lastBackupAt };
  }

  const { put, list, del } = await import("@vercel/blob");
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
  return { enabled: true, saved: true, url: blob.url };
}

async function pruneBlobBackups({ userId, list, del }) {
  const result = await list({
    prefix: `promptbuilder/backups/${userId}/`,
    limit: 100,
  });
  const sorted = (result.blobs || [])
    .map((blob) => ({
      url: blob.url,
      uploadedAt: blob.uploadedAt || blob.createdAt || null,
    }))
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  const oldBackups = sorted.slice(BLOB_BACKUP_LIMIT);
  if (oldBackups.length) await del(oldBackups.map((backup) => backup.url));
}

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!["GET", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const sql = getSql();
    await ensureSchema(sql);
    const userId = getUserId();

    if (req.method === "GET") {
      const rows = await sql`
        select data, updated_at
        from promptbuilder_data
        where user_id = ${userId}
        limit 1
      `;
      const row = rows[0];
      res.status(200).json({
        data: row?.data || null,
        updatedAt: row?.updated_at || null,
      });
      return;
    }

    const body = await readJsonBody(req);
    if (!body.data || typeof body.data !== "object") {
      res.status(400).json({ error: "Missing data object" });
      return;
    }

    const rows = await sql`
      insert into promptbuilder_data (user_id, data, updated_at)
      values (${userId}, ${JSON.stringify(body.data)}::jsonb, now())
      on conflict (user_id)
      do update set data = excluded.data, updated_at = now()
      returning updated_at
    `;
    await sql`
      insert into promptbuilder_snapshots (user_id, data)
      values (${userId}, ${JSON.stringify(body.data)}::jsonb)
    `;
    await sql`
      delete from promptbuilder_snapshots
      where id in (
        select id
        from (
          select id, row_number() over (partition by user_id order by created_at desc) as snapshot_rank
          from promptbuilder_snapshots
          where user_id = ${userId}
        ) ranked
        where snapshot_rank > 5
      )
    `;
    let blobBackup = { enabled: body.data?.settings?.blobWeeklyBackup === true, skipped: true };
    try {
      blobBackup = await maybeRunBlobBackup(sql, userId, body.data);
    } catch (error) {
      blobBackup = {
        enabled: true,
        skipped: true,
        error: process.env.NODE_ENV === "production" ? "Blob backup failed" : error.message,
      };
    }
    res.status(200).json({ ok: true, updatedAt: rows[0].updated_at, blobBackup });
  } catch (error) {
    res.status(500).json({
      error: "Database request failed",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
