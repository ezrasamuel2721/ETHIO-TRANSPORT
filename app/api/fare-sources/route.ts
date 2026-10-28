import { NextResponse } from "next/server";

type Source = {
  id?: string;
  organization_name?: string;
  source_url: string;
  title?: string;
  status?: string;
};

type SourceCheck = Source & {
  checkedAt: string;
  reachable: boolean;
  discoveredTables: number;
  discoveredFareRows: number;
};

let cache: { expires: number; sources: SourceCheck[] } | null = null;

function htmlText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isOfficialFareSource(source: Source) {
  try {
    const host = new URL(String(source.source_url || "")).hostname.toLowerCase().replace(/^www\./, "");
    const officialHost = host.endsWith(".gov.et") ||
      host === "anrstlob.et" || host.endsWith(".anrstlob.et") ||
      host === "srsrb.org" || host.endsWith(".srsrb.org");
    const identity = String(source.organization_name || "") + " " + String(source.title || "");
    return officialHost && /(transport|road|logistics|public and private transportation|ministry of justice)/i.test(identity);
  } catch {
    return false;
  }
}

function countFareTables(html: string) {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) || [];
  let fareTables = 0;
  let fareRows = 0;
  for (const table of tables) {
    const text = htmlText(table).toLowerCase();
    const hasFare = /(fare|tariff|ታሪፍ|ክፍያ)/i.test(text);
    const hasDistance = /(km|kilometer|kilometre|ኪ\.?ሜ|distance)/i.test(text);
    if (hasFare && hasDistance) {
      fareTables += 1;
      fareRows += Math.max(0, (table.match(/<tr\b/gi) || []).length - 1);
    }
  }
  return { tables: fareTables, fareRows };
}

async function readSources(base: string, key: string) {
  const url = new URL("/rest/v1/transport_sources", base);
  url.searchParams.set("select", "id,organization_name,source_url,title,status");
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Could not read transport sources.");
  const rows = (await response.json()) as Source[];
  // This endpoint is labelled as an official-source monitor in the UI.
  // Exclude news sites, booking marketplaces, and other secondary sources.
  return rows.filter(isOfficialFareSource);
}

async function checkSource(source: Source): Promise<SourceCheck> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(source.source_url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ETHIO-TRANSPORT/1.0 (+official-source-check)",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ...source, checkedAt, reachable: false, discoveredTables: 0, discoveredFareRows: 0 };
    const html = await response.text();
    const counts = countFareTables(html);
    return { ...source, checkedAt, reachable: true, discoveredTables: counts.tables, discoveredFareRows: counts.fareRows };
  } catch {
    return { ...source, checkedAt, reachable: false, discoveredTables: 0, discoveredFareRows: 0 };
  }
}

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return NextResponse.json({ error: "Source service is not configured." }, { status: 503 });

  if (cache && cache.expires > Date.now()) {
    return NextResponse.json({ sources: cache.sources, checkedAt: new Date().toISOString(), cached: true });
  }

  try {
    const sources = await readSources(base, key);
    const checks = await Promise.all(sources.map(checkSource));
    cache = { expires: Date.now() + 5 * 60_000, sources: checks };
    return NextResponse.json(
      { sources: checks, checkedAt: new Date().toISOString(), cached: false },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Source service unavailable." }, { status: 503 });
  }
}
