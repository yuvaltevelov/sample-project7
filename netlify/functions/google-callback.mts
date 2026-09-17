import type { Config, Context } from "@netlify/functions";
import { exchangeGoogleCode, GOOGLE_SCOPES } from "./_google-oauth.mts";
import { clearOauthNonceCookie, resolveRedirectUri, validateCallbackState } from "./_google-auth-flow.mts";
import { chooseRefreshToken, isAllowedEmail } from "./_google-session-core.mts";
import { getGoogleAuth, saveGoogleAuth } from "./_google-session.mts";

type UserInfo = {
  email?: string;
  email_verified?: boolean;
};

const redirectResponse = (location: string, clearCookie = true) => new Response(null, {
  status: 302,
  headers: {
    location,
    ...(clearCookie ? { "set-cookie": clearOauthNonceCookie() } : {}),
    "cache-control": "no-store",
  },
});

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) {
    return redirectResponse("/?google=denied#connections");
  }

  const code = url.searchParams.get("code");
  const signedState = url.searchParams.get("state");
  const clientId = Netlify.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Netlify.env.get("GOOGLE_CLIENT_SECRET");
  const stateSecret = Netlify.env.get("OAUTH_STATE_SECRET");

  if (!code || !signedState || !clientId || !clientSecret || !stateSecret) {
    return redirectResponse("/?google=invalid#connections");
  }

  const state = await validateCallbackState(
    signedState,
    req.headers.get("cookie") || "",
    stateSecret,
  );
  if (!state) return redirectResponse("/?google=state_error#connections");

  try {
    const redirectUri = resolveRedirectUri(req.url, Netlify.env.get("GOOGLE_REDIRECT_URI"));
    const tokens = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) throw new Error("Google userinfo request failed");
    const user = await userInfoResponse.json() as UserInfo;
    if (!user.email || user.email_verified !== true) throw new Error("Google email is not verified");
    if (!isAllowedEmail(user.email, Netlify.env.get("ALLOWED_GOOGLE_EMAIL"))) {
      return redirectResponse("/?google=wrong_account#connections");
    }

    const existing = await getGoogleAuth();
    const refreshToken = chooseRefreshToken(tokens.refresh_token, existing?.refreshToken);
    if (!refreshToken) {
      return redirectResponse("/?google=no_refresh_token#connections");
    }

    await saveGoogleAuth({
      email: user.email,
      refreshToken,
      scopes: tokens.scope?.split(" ").filter(Boolean) || GOOGLE_SCOPES,
      connectedAt: new Date().toISOString(),
    });

    return redirectResponse(state.returnTo);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return redirectResponse("/?google=callback_error#connections");
  }
};

export const config: Config = {
  path: "/api/google/callback",
};
