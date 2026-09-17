import test from "node:test";
import assert from "node:assert/strict";
import { signState } from "../netlify/functions/_google-oauth.mts";
import {
  parseCookies,
  validateCallbackState,
  resolveRedirectUri,
  oauthNonceCookie,
} from "../netlify/functions/_google-auth-flow.mts";

test("parseCookies handles URL-encoded values without trusting duplicate keys", () => {
  assert.deepEqual(parseCookies("a=1; ih_oauth_nonce=n%2D1; a=2"), { a: "1", ih_oauth_nonce: "n-1" });
});

test("validateCallbackState requires signed state and matching HttpOnly nonce cookie", async () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const signed = await signState({ nonce: "n-1", returnTo: "/#connections", expiresAt: 2000 }, secret);
  assert.deepEqual(await validateCallbackState(signed, "ih_oauth_nonce=n-1", secret, 1999), {
    nonce: "n-1", returnTo: "/#connections", expiresAt: 2000,
  });
  assert.equal(await validateCallbackState(signed, "ih_oauth_nonce=wrong", secret, 1999), null);
  assert.equal(await validateCallbackState(signed, "", secret, 1999), null);
});

test("resolveRedirectUri prefers explicit env URL and otherwise uses request origin", () => {
  assert.equal(resolveRedirectUri("https://app.example/api/google/start", "https://fixed.example/cb"), "https://fixed.example/cb");
  assert.equal(resolveRedirectUri("https://app.example/api/google/start", ""), "https://app.example/api/google/callback");
});

test("oauthNonceCookie is secure, HttpOnly, SameSite=Lax and scoped to Google auth routes", () => {
  const cookie = oauthNonceCookie("n-1", 600);
  assert.match(cookie, /ih_oauth_nonce=n-1/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\/api\/google/);
  assert.match(cookie, /Max-Age=600/);
});
