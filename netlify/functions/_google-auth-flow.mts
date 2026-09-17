import { verifyState } from "./_google-oauth.mts";

export function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    const rawKey = eq === -1 ? trimmed : trimmed.slice(0, eq);
    const rawValue = eq === -1 ? "" : trimmed.slice(eq + 1);
    const key = decodeURIComponent(rawKey);
    if (Object.prototype.hasOwnProperty.call(out, key)) continue;
    try {
      out[key] = decodeURIComponent(rawValue);
    } catch {
      out[key] = rawValue;
    }
  }
  return out;
}

export function resolveRedirectUri(requestUrl: string, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  const url = new URL(requestUrl);
  return `${url.origin}/api/google/callback`;
}

export function oauthNonceCookie(nonce: string, maxAgeSeconds: number): string {
  return `ih_oauth_nonce=${encodeURIComponent(nonce)}; Path=/api/google; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearOauthNonceCookie(): string {
  return "ih_oauth_nonce=; Path=/api/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}

export async function validateCallbackState(
  signedState: string,
  cookieHeader: string,
  secret: string,
  now = Date.now(),
) {
  const payload = await verifyState(signedState, secret, now);
  if (!payload) return null;
  const nonce = parseCookies(cookieHeader).ih_oauth_nonce;
  if (!nonce || nonce !== payload.nonce) return null;
  return payload;
}
