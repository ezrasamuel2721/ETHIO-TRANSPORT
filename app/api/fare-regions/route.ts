import { NextResponse } from "next/server";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return json({ error: "Fare region database is not configured." }, 503);

  const url = new URL("/rest/v1/transport_regions", base);
  url.searchParams.set("select", "code,name,name_am,type");
  url.searchParams.set("active", "eq.true");
  url.searchParams.set("order", "type.asc,name.asc");

  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return json({ error: "Could not read fare regions." }, 502);
    return json({ regions: await response.json() });
  } catch {
    return json({ error: "Fare region service is temporarily unavailable." }, 503);
  }
}
