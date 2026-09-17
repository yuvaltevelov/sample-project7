import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGoogleAuthUrl,
  signState,
  verifyState,
  exchangeGoogleCode,
  refreshGoogleToken,
  GOOGLE_SCOPES,
} from "../netlify/functions/_google-oauth.mts";

test("buildGoogleAuthUrl requests offline access with exact redirect URI and least-privilege scopes", () => {
  const url = new URL(buildGoogleAuthUrl({
    clientId: "client-123",
    redirectUri: "https://example.com/api/google/callback",
    state: "state-abc",
    loginHint: "owner@example.com",
  }));

  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://example.com/api/google/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("include_granted_scopes"), "true");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "state-abc");
  assert.equal(url.searchParams.get("login_hint"), "owner@example.com");
  assert.deepEqual(url.searchParams.get("scope").split(" "), GOOGLE_SCOPES);
});

test("signed OAuth state verifies only with the same secret and before expiry", async () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const signed = await signState({ nonce: "n-1", returnTo: "/#connections", expiresAt: 2_000 }, secret);
  assert.deepEqual(await verifyState(signed, secret, 1_999), {
    nonce: "n-1", returnTo: "/#connections", expiresAt: 2_000,
  });
  assert.equal(await verifyState(signed, "different-secret-different-secret", 1_999), null);
  assert.equal(await verifyState(signed, secret, 2_001), null);
});

test("exchangeGoogleCode posts form data to Google token endpoint and returns tokens", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push([url, init]);
    return new Response(JSON.stringify({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const tokens = await exchangeGoogleCode({
    code: "code-1", clientId: "id-1", clientSecret: "secret-1", redirectUri: "https://app.test/api/google/callback", fetchImpl: fakeFetch,
  });
  assert.equal(tokens.refresh_token, "refresh-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://oauth2.googleapis.com/token");
  const body = new URLSearchParams(calls[0][1].body);
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code"), "code-1");
  assert.equal(body.get("redirect_uri"), "https://app.test/api/google/callback");
});

test("refreshGoogleToken uses refresh_token grant and fails closed on upstream error", async () => {
  const okFetch = async (_url, init) => {
    const body = new URLSearchParams(init.body);
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "refresh-1");
    return new Response(JSON.stringify({ access_token: "access-2", expires_in: 3600 }), { status: 200 });
  };
  const result = await refreshGoogleToken({ refreshToken: "refresh-1", clientId: "id", clientSecret: "secret", fetchImpl: okFetch });
  assert.equal(result.access_token, "access-2");

  const badFetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
  await assert.rejects(
    refreshGoogleToken({ refreshToken: "bad", clientId: "id", clientSecret: "secret", fetchImpl: badFetch }),
    /Google token request failed/,
  );
});
