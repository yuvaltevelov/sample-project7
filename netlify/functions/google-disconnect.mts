import type { Config, Context } from "@netlify/functions";
import { clearGoogleAuth } from "./_google-session.mts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  }

  await clearGoogleAuth();
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
};

export const config: Config = {
  path: "/api/google/disconnect",
};
