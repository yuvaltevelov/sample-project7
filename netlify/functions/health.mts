import type { Config, Context } from "@netlify/functions";

export default async (_req: Request, _context: Context) => {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "intelligence-hub",
      version: "0.2.0",
      mode: "connector-ready"
    }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
};

export const config: Config = {
  path: "/api/health"
};
