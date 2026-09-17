import type { Config, Context } from "@netlify/functions";
import { getGoogleAuth, googleOAuthConfigured } from "./_google-session.mts";

const configured = (...keys: string[]) => keys.every((key) => Boolean(Netlify.env.get(key)));

export default async (_req: Request, _context: Context) => {
  const googleConfigured = googleOAuthConfigured() && Boolean(Netlify.env.get("OAUTH_STATE_SECRET"));
  const googleAuth = googleConfigured ? await getGoogleAuth() : null;
  const marketConfigured = configured("MARKET_API_KEY");

  const connectors = {
    gmail: Boolean(googleAuth),
    calendar: Boolean(googleAuth),
    drive: false,
    news: true,
    markets: marketConfigured,
  };

  const available = {
    gmail: googleConfigured,
    calendar: googleConfigured,
    drive: false,
    news: true,
    markets: marketConfigured,
  };

  return Response.json(
    {
      mode: Object.values(connectors).some(Boolean) ? "partial" : "demo",
      connectors,
      available,
      googleConnectedAt: googleAuth?.connectedAt ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config: Config = {
  path: "/api/connectors",
};
