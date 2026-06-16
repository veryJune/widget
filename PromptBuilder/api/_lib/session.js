const crypto = require("crypto");

const COOKIE_NAME = "promptbuilder_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function getPassword() {
  return process.env.APP_PASSWORD || "";
}

function getSecret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
}

function getUserId() {
  return process.env.PROMPTBUILDER_USER_ID || "default";
}

function createSessionToken() {
  const secret = getSecret();
  return crypto.createHmac("sha256", secret).update(`promptbuilder:${getPassword()}`).digest("hex");
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function isAuthenticated(req) {
  if (!getPassword()) return false;
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[COOKIE_NAME] === createSessionToken();
}

function setSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(createSessionToken())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

module.exports = {
  clearSessionCookie,
  getPassword,
  getUserId,
  isAuthenticated,
  readJsonBody,
  setSessionCookie,
};
