const { neon } = require("@neondatabase/serverless");
const { getUserId, isAuthenticated, readJsonBody } = require("./_lib/session");

let sqlClient = null;

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
}

function summarizeData(data = {}) {
  return {
    itemCount: Array.isArray(data.items) ? data.items.length : 0,
    categoryCount: Array.isArray(data.categories) ? data.categories.length : 0,
    updatedAt: data.updatedAt || null,
  };
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

  try {
    const sql = getSql();
    await ensureSchema(sql);
    const userId = getUserId();

    if (req.method === "GET") {
      const rows = await sql`
        select id, data, created_at
        from promptbuilder_snapshots
        where user_id = ${userId}
        order by created_at desc
        limit 5
      `;
      res.status(200).json({
        snapshots: rows.map((row) => ({
          id: String(row.id),
          createdAt: row.created_at,
          ...summarizeData(row.data),
        })),
      });
      return;
    }

    const body = await readJsonBody(req);
    if (body.action === "create") {
      if (!body.data || typeof body.data !== "object") {
        res.status(400).json({ error: "Missing data object" });
        return;
      }
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
      res.status(200).json({ ok: true });
      return;
    }

    const snapshotId = Number(body.id);
    if (!Number.isSafeInteger(snapshotId) || snapshotId <= 0) {
      res.status(400).json({ error: "Missing snapshot id" });
      return;
    }

    const rows = await sql`
      select data
      from promptbuilder_snapshots
      where user_id = ${userId} and id = ${snapshotId}
      limit 1
    `;
    const snapshot = rows[0];
    if (!snapshot) {
      res.status(404).json({ error: "Snapshot not found" });
      return;
    }

    const updated = await sql`
      insert into promptbuilder_data (user_id, data, updated_at)
      values (${userId}, ${JSON.stringify(snapshot.data)}::jsonb, now())
      on conflict (user_id)
      do update set data = excluded.data, updated_at = now()
      returning data, updated_at
    `;
    res.status(200).json({ ok: true, data: updated[0].data, updatedAt: updated[0].updated_at });
  } catch (error) {
    res.status(500).json({
      error: "Snapshot request failed",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
