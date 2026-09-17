import type { Config, Context } from "@netlify/functions";
import { getFreshGoogleAccessToken } from "./_google-session.mts";

type CalendarDate = { dateTime?: string; date?: string; timeZone?: string };
type CreateCalendarInput = {
  title?: string;
  description?: string;
  start?: CalendarDate;
  end?: CalendarDate;
  source?: string;
};

async function calendarFetch(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Calendar API failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return response;
}

function validCalendarDate(value?: CalendarDate): value is CalendarDate {
  return Boolean(value && ((value.dateTime && !value.date) || (value.date && !value.dateTime)));
}

export default async (req: Request, _context: Context) => {
  try {
    const { accessToken } = await getFreshGoogleAccessToken();

    if (req.method === "GET") {
      const requestUrl = new URL(req.url);
      const requestedDays = Number(requestUrl.searchParams.get("days") || 14);
      const days = Number.isFinite(requestedDays) ? Math.min(90, Math.max(1, Math.round(requestedDays))) : 14;
      const timeMin = new Date();
      const timeMax = new Date(timeMin.getTime() + days * 24 * 60 * 60 * 1000);

      const query = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
      });
      const response = await calendarFetch(`/calendars/primary/events?${query}`, accessToken);
      const payload = await response.json() as { items?: any[] };
      const events = (payload.items || []).map((event) => ({
        id: event.id,
        title: event.summary || "(ללא כותרת)",
        description: event.description || "",
        start: event.start || null,
        end: event.end || null,
        htmlLink: event.htmlLink || null,
        intelligenceHub: event.extendedProperties?.private?.intelligenceHub === "true",
        source: event.extendedProperties?.private?.intelligenceHubSource || null,
      }));

      return Response.json(
        { ok: true, source: "Google Calendar", fetchedAt: new Date().toISOString(), days, events },
        { headers: { "cache-control": "private, no-store" } },
      );
    }

    if (req.method === "POST") {
      let input: CreateCalendarInput;
      try {
        input = await req.json() as CreateCalendarInput;
      } catch {
        return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
      }

      const title = input.title?.trim();
      if (!title || !validCalendarDate(input.start) || !validCalendarDate(input.end)) {
        return Response.json({ ok: false, error: "title_start_and_end_required" }, { status: 400 });
      }

      const eventBody = {
        summary: title.startsWith("IH ·") ? title : `IH · ${title}`,
        description: [input.description?.trim(), "Created by Intelligence Hub"].filter(Boolean).join("\n\n"),
        start: input.start,
        end: input.end,
        extendedProperties: {
          private: {
            intelligenceHub: "true",
            intelligenceHubSource: input.source?.slice(0, 60) || "Manual",
          },
        },
      };

      const response = await calendarFetch("/calendars/primary/events", accessToken, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });
      const event = await response.json() as any;

      return Response.json({
        ok: true,
        event: {
          id: event.id,
          title: event.summary,
          start: event.start,
          end: event.end,
          htmlLink: event.htmlLink || null,
          intelligenceHub: true,
        },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST" } });
  } catch (error) {
    console.error("Calendar connector failed", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return Response.json(
      { ok: false, error: message.includes("not connected") ? "google_not_connected" : "calendar_connector_failed" },
      { status: message.includes("not connected") ? 401 : 502, headers: { "cache-control": "no-store" } },
    );
  }
};

export const config: Config = {
  path: "/api/calendar",
};
