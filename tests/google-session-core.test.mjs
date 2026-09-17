import test from "node:test";
import assert from "node:assert/strict";
import { chooseRefreshToken, isAllowedEmail } from "../netlify/functions/_google-session-core.mts";

test("chooseRefreshToken prefers a newly issued token and otherwise preserves existing token", () => {
  assert.equal(chooseRefreshToken("new-token", "old-token"), "new-token");
  assert.equal(chooseRefreshToken(undefined, "old-token"), "old-token");
  assert.equal(chooseRefreshToken("", "old-token"), "old-token");
  assert.equal(chooseRefreshToken(undefined, undefined), null);
});

test("isAllowedEmail matches case-insensitively and allows any verified email when no allowlist is configured", () => {
  assert.equal(isAllowedEmail("Yuval@Example.com", "yuval@example.com"), true);
  assert.equal(isAllowedEmail("other@example.com", "yuval@example.com"), false);
  assert.equal(isAllowedEmail("other@example.com", ""), true);
});
