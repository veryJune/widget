const {
  clearSessionCookie,
  getPassword,
  readJsonBody,
  setSessionCookie,
} = require("./_lib/session");

module.exports = async function handler(req, res) {
  if (req.method === "DELETE") {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, DELETE");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const appPassword = getPassword();
  if (!appPassword) {
    res.status(500).json({ error: "APP_PASSWORD is not configured" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (body.password !== appPassword) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    setSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid request body" });
  }
};
