const { neon } = require("@neondatabase/serverless");
const {
  getUserId,
  isAuthenticated,
  readJsonBody,
} = require("./_lib/session");

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
    res.status(200).json({ ok: true, updatedAt: rows[0].updated_at });
  } catch (error) {
    res.status(500).json({
      error: "Database request failed",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
