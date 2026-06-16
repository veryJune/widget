const { neon } = require("@neondatabase/serverless");
const { getUserId, isAuthenticated } = require("./_lib/session");

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const checks = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    appPassword: Boolean(process.env.APP_PASSWORD),
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    userId: getUserId(),
    dbConnected: false,
    dataUpdatedAt: null,
    itemCount: 0,
    categoryCount: 0,
    snapshotCount: 0,
  };

  if (!process.env.DATABASE_URL) {
    res.status(200).json({ ok: false, checks });
    return;
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`select 1`;
    checks.dbConnected = true;
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

    const rows = await sql`
      select data, updated_at
      from promptbuilder_data
      where user_id = ${checks.userId}
      limit 1
    `;
    if (rows[0]) {
      checks.dataUpdatedAt = rows[0].updated_at;
      checks.itemCount = Array.isArray(rows[0].data?.items) ? rows[0].data.items.length : 0;
      checks.categoryCount = Array.isArray(rows[0].data?.categories) ? rows[0].data.categories.length : 0;
    }

    const snapshotRows = await sql`
      select count(*)::int as count
      from promptbuilder_snapshots
      where user_id = ${checks.userId}
    `.catch(() => [{ count: 0 }]);
    checks.snapshotCount = snapshotRows[0]?.count || 0;

    res.status(200).json({ ok: checks.dbConnected, checks });
  } catch (error) {
    res.status(200).json({
      ok: false,
      checks,
      error: process.env.NODE_ENV === "production" ? "Database check failed" : error.message,
    });
  }
};
