import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return NextResponse.json({ operators: [] }, { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL("/rest/v1/transport_operators", base);
    url.searchParams.set("select", "id,name,name_am,name_om,name_en,booking_url,source_id(organization_name,source_url,title)");
    url.searchParams.set("active", "eq.true");
    url.searchParams.set("order", "name.asc");
    const r = await fetch(url, {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
      signal: controller.signal
    });
    if (!r.ok) return NextResponse.json({ error: "Operator directory unavailable." }, { status: 503 });
    const operators = await r.json();
    return NextResponse.json({ operators: Array.isArray(operators) ? operators : [] }, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1800" }
    });
  } catch {
    return NextResponse.json({ error: "Operator directory unavailable." }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
