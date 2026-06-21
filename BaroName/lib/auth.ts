import crypto from "crypto";

const COOKIE_NAME = "baroname_session";

export { COOKIE_NAME };

function getSecret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "baroname-dev-secret";
}

export function createSessionToken() {
  const issuedAt = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(issuedAt)
    .digest("hex");

  return `${issuedAt}.${signature}`;
}

export function isValidSession(token?: string) {
  if (!token) {
    return false;
  }

  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) {
    return false;
  }

  const age = Date.now() - Number(issuedAt);
  const maxAge = 1000 * 60 * 60 * 24 * 30;
  if (!Number.isFinite(age) || age < 0 || age > maxAge) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(issuedAt)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function verifyPassword(password: string) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(appPassword));
  } catch {
    return false;
  }
}
