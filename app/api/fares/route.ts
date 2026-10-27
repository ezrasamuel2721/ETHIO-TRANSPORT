import { NextRequest, NextResponse } from "next/server";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const serviceType = (new URL(request.url).searchParams.get("serviceType") || "bus").trim();
  if (!["bus", "taxi", "rail", "other"].includes(serviceType)) {
    return json({ error: "Unsupported service type." }, 400);
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return json({ error: "Fare database is not configured." }, 503);

  const url = new URL("/rest/v1/transport_fares", base);
  url.searchParams.set("select", "id,service_type,vehicle_category,rate_per_km,base_fare,minimum_fare,currency,effective_from,effective_to,status,source_id(organization_name,source_url,title)");
  url.searchParams.set("service_type", `eq.${serviceType}`);
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("order", "effective_from.desc");
  url.searchParams.set("limit", "20");

  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok) return json({ error: "Could not read verified fare data." }, 502);
    const now = Date.now();
    const fares = (data || []).filter((row: any) => {
      const from = row.effective_from ? Date.parse(row.effective_from) : -Infinity;
      const to = row.effective_to ? Date.parse(row.effective_to) : Infinity;
      return from <= now && now <= to;
    });
    return json({ serviceType, fares });
  } catch {
    return json({ error: "Fare service is temporarily unavailable." }, 503);
  }
}
