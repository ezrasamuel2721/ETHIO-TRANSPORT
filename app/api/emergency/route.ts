import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return NextResponse.json({ error: "Emergency directory is not configured." }, { status: 503 });

  const url = new URL("/rest/v1/emergency_contacts", base);
  url.searchParams.set("select", "id,name,name_am,name_om,name_en,phone,area,active,source_id(organization_name,source_url,title)");
  url.searchParams.set("active", "eq.true");
  url.searchParams.set("order", "name.asc");
  url.searchParams.set("limit", "50");

  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return NextResponse.json({ error: "Could not read verified emergency contacts." }, { status: 502 });
    return NextResponse.json({ contacts: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Emergency directory is temporarily unavailable." }, { status: 503 });
  }
}
