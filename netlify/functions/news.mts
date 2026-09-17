import type { Config, Context } from "@netlify/functions";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

const INTERESTS: Array<[string, number]> = [
  ["artificial intelligence", 6],
  ["ai", 4],
  ["semiconductor", 6],
  ["chip", 5],
  ["data center", 5],
  ["inflation", 5],
  ["central bank", 5],
  ["interest rate", 5],
  ["biotech", 4],
  ["medicine", 3],
  ["renewable", 4],
  ["nuclear", 4],
  ["energy", 3],
  ["real estate", 3],
  ["israel", 4],
  ["startup", 3],
  ["robotics", 4],
  ["quantum", 4]
];

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const relevance = (article: GdeltArticle) => {
  const haystack = `${article.title ?? ""} ${article.domain ?? ""}`.toLowerCase();
  return INTERESTS.reduce((score, [term, weight]) => score + (haystack.includes(term) ? weight : 0), 0);
};

const dedupe = (articles: GdeltArticle[]) => {
  const seen = new Set<string>();
  const result: GdeltArticle[] = [];

  for (const article of articles) {
    const title = normalizeTitle(article.title ?? "");
    if (!title) continue;
    const key = title.split(" ").slice(0, 12).join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
};

export default async (_req: Request, _context: Context) => {
  const query = '("artificial intelligence" OR semiconductor OR "data center" OR inflation OR "central bank" OR biotech OR "renewable energy" OR nuclear OR robotics OR quantum OR "real estate" OR Israel)';
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "50");
  url.searchParams.set("timespan", "24h");
  url.searchParams.set("sort", "datedesc");

  const response = await fetch(url, {
    headers: { "user-agent": "Intelligence-Hub/0.2" }
  });

  const text = await response.text();
  let payload: { articles?: GdeltArticle[] };

  try {
    payload = JSON.parse(text);
  } catch {
    return new Response(
      JSON.stringify({ ok: false, source: "GDELT", error: "upstream_non_json" }),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const articles = dedupe(payload.articles ?? [])
    .map((article) => ({
      title: article.title ?? "Untitled",
      url: article.url ?? null,
      image: article.socialimage ?? null,
      domain: article.domain ?? null,
      seenAt: article.seendate ?? null,
      language: article.language ?? null,
      sourceCountry: article.sourcecountry ?? null,
      relevance: relevance(article)
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 20);

  return new Response(
    JSON.stringify({
      ok: true,
      source: "GDELT DOC 2.0",
      fetchedAt: new Date().toISOString(),
      count: articles.length,
      articles
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=120, s-maxage=300"
      }
    }
  );
};

export const config: Config = {
  path: "/api/news"
};
