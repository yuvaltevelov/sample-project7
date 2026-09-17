import type { Config, Context } from "@netlify/functions";
import { getFreshGoogleAccessToken } from "./_google-session.mts";
import { classifyEmail } from "./_email-intelligence.mts";

type GmailHeader = { name?: string; value?: string };
type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

async function gmailFetch(path: string, accessToken: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail API failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return response;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
  }

  try {
    const { accessToken } = await getFreshGoogleAccessToken();
    const url = new URL(req.url);
    const requestedDays = Number(url.searchParams.get("days") || 7);
    const days = Number.isFinite(requestedDays) ? Math.min(30, Math.max(1, Math.round(requestedDays))) : 7;
    const includeAll = url.searchParams.get("all") === "1";

    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("q", `newer_than:${days}d`);
    listUrl.searchParams.set("maxResults", "25");

    const listResponse = await fetch(listUrl, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!listResponse.ok) throw new Error(`Gmail list failed (${listResponse.status})`);
    const list = await listResponse.json() as { messages?: Array<{ id?: string }> };

    const messages = await Promise.all((list.messages || []).filter((item) => item.id).map(async (item) => {
      const detail = new URL(`/gmail/v1/users/me/messages/${encodeURIComponent(item.id!)}`, "https://gmail.googleapis.com");
      detail.searchParams.set("format", "metadata");
      detail.searchParams.append("metadataHeaders", "From");
      detail.searchParams.append("metadataHeaders", "Subject");
      detail.searchParams.append("metadataHeaders", "Date");

      const response = await gmailFetch(`${detail.pathname}${detail.search}`, accessToken);
      const message = await response.json() as GmailMessage;
      const from = header(message, "From");
      const subject = header(message, "Subject") || "(ללא נושא)";
      const date = header(message, "Date");
      const snippet = message.snippet || "";
      const classification = classifyEmail({ from, subject, snippet });

      return {
        id: message.id,
        threadId: message.threadId,
        from,
        subject,
        date,
        internalDate: message.internalDate ? Number(message.internalDate) : null,
        snippet,
        ...classification,
      };
    }));

    const filtered = messages
      .filter((message) => includeAll || message.relevant)
      .sort((a, b) => {
        const priority = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
        if (priority) return priority;
        return (b.internalDate || 0) - (a.internalDate || 0);
      });

    return Response.json(
      {
        ok: true,
        source: "Gmail",
        fetchedAt: new Date().toISOString(),
        days,
        count: filtered.length,
        messages: filtered,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Gmail connector failed", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return Response.json(
      { ok: false, error: message.includes("not connected") ? "google_not_connected" : "gmail_connector_failed" },
      { status: message.includes("not connected") ? 401 : 502, headers: { "cache-control": "no-store" } },
    );
  }
};

export const config: Config = {
  path: "/api/gmail",
};
