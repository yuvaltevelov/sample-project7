import { getDeployStore, getStore } from "@netlify/blobs";
import { refreshGoogleToken } from "./_google-oauth.mts";

export type StoredGoogleAuth = {
  email: string;
  refreshToken: string;
  scopes: string[];
  connectedAt: string;
};

function authStore() {
  const isProduction = Netlify.context?.deploy?.context === "production";
  return isProduction
    ? getStore("ih-auth", { consistency: "strong" })
    : getDeployStore("ih-auth");
}

export async function getGoogleAuth(): Promise<StoredGoogleAuth | null> {
  return await authStore().get("google-primary", { type: "json" }) as StoredGoogleAuth | null;
}

export async function saveGoogleAuth(auth: StoredGoogleAuth): Promise<void> {
  await authStore().setJSON("google-primary", auth);
}

export async function clearGoogleAuth(): Promise<void> {
  await authStore().delete("google-primary");
}

export function googleOAuthConfigured(): boolean {
  return Boolean(Netlify.env.get("GOOGLE_CLIENT_ID") && Netlify.env.get("GOOGLE_CLIENT_SECRET"));
}

export async function getFreshGoogleAccessToken(): Promise<{ accessToken: string; auth: StoredGoogleAuth }> {
  const auth = await getGoogleAuth();
  if (!auth) throw new Error("Google account is not connected");

  const clientId = Netlify.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Netlify.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");

  const tokens = await refreshGoogleToken({
    refreshToken: auth.refreshToken,
    clientId,
    clientSecret,
  });

  return { accessToken: tokens.access_token, auth };
}
