export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

type StatePayload = {
  nonce: string;
  returnTo: string;
  expiresAt: number;
};

type AuthUrlInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string;
};

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type FetchLike = typeof fetch;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function unbase64url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function buildGoogleAuthUrl(input: AuthUrlInput): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", input.state);
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  return url.toString();
}

export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyState(
  signed: string,
  secret: string,
  now = Date.now(),
): Promise<StatePayload | null> {
  const [body, signature, extra] = signed.split(".");
  if (!body || !signature || extra) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    unbase64url(signature),
    encoder.encode(body),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(decoder.decode(unbase64url(body))) as StatePayload;
    if (!payload.nonce || !payload.returnTo.startsWith("/") || payload.expiresAt < now) return null;
    return payload;
  } catch {
    return null;
  }
}

async function tokenRequest(body: URLSearchParams, fetchImpl: FetchLike): Promise<TokenResponse> {
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token request failed (${response.status}): ${errorText.slice(0, 200)}`);
  }
  return await response.json() as TokenResponse;
}

export async function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: FetchLike;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  return tokenRequest(body, input.fetchImpl ?? fetch);
}

export async function refreshGoogleToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchLike;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
  });
  return tokenRequest(body, input.fetchImpl ?? fetch);
}
