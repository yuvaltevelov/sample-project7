import type { Config, Context } from "@netlify/functions";

const configured = (...keys: string[]) => keys.every((key) => Boolean(Netlify.env.get(key)));

export default async (_req: Request, _context: Context) => {
  const connectors = {
    gmail: configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    calendar: configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    drive: configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    news: configured("NEWS_API_KEY"),
    markets: configured("MARKET_API_KEY")
  };

  return new Response(
    JSON.stringify({
      mode: Object.values(connectors).some(Boolean) ? "partial" : "demo",
      connectors
    }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
};

export const config: Config = {
  path: "/api/connectors"
};
