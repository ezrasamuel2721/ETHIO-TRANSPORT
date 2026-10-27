import { NextResponse } from "next/server";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return json({ error: "Ticket provider database is not configured." }, 503);

  const url = new URL("/rest/v1/ticket_providers", base);
  url.searchParams.set("select", "id,name,booking_url,active,source_id(organization_name,source_url,title)");
  url.searchParams.set("active", "eq.true");
  url.searchParams.set("order", "name.asc");
  url.searchParams.set("limit", "50");

  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return json({ error: "Could not read verified ticket providers." }, 502);
    const providers = await response.json();
    return json({ providers });
  } catch {
    return json({ error: "Ticket provider service is temporarily unavailable." }, 503);
  }
}
