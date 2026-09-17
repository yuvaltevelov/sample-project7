import type { Config, Context } from "@netlify/functions";
import { buildGoogleAuthUrl, signState } from "./_google-oauth.mts";
import { oauthNonceCookie, resolveRedirectUri } from "./_google-auth-flow.mts";

export default async (req: Request, _context: Context) => {
  const clientId = Netlify.env.get("GOOGLE_CLIENT_ID");
  const stateSecret = Netlify.env.get("OAUTH_STATE_SECRET");
  if (!clientId || !stateSecret) {
    return Response.json(
      { ok: false, error: "google_oauth_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const redirectUri = resolveRedirectUri(req.url, Netlify.env.get("GOOGLE_REDIRECT_URI"));
  const nonce = crypto.randomUUID();
  const state = await signState(
    {
      nonce,
      returnTo: "/#connections",
      expiresAt: Date.now() + 10 * 60 * 1000,
    },
    stateSecret,
  );

  const location = buildGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
    loginHint: Netlify.env.get("ALLOWED_GOOGLE_EMAIL") || undefined,
  });

  return new Response(null, {
    status: 302,
    headers: {
      location,
      "set-cookie": oauthNonceCookie(nonce, 600),
      "cache-control": "no-store",
    },
  });
};

export const config: Config = {
  path: "/api/google/start",
};
