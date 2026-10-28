import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const endpoint = process.env.TRANSPORT_TARIFFS_URL;
  if (endpoint) {
    try {
      const u = new URL(endpoint);
      const incoming = new URL(request.url).searchParams;
      for (const key of ["serviceType", "regionCode", "city", "area", "distanceKm"]) {
        const value = incoming.get(key);
        if (value) u.searchParams.set(key, value);
      }
      const r = await fetch(u, { cache: "no-store", headers: { Accept: "application/json" } });
      if (r.ok) return NextResponse.json({ ok: true, source: "authorized-endpoint", data: await r.json() });
    } catch {}
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ ok: false, source: "not_configured", message: "Tariff service is not configured." }, { status: 503 });
  }

  try {
    const u = new URL("/rest/v1/transport_fares", base);
    u.searchParams.set("select", "id,service_type,vehicle_category,rate_per_km,base_fare,minimum_fare,fixed_fare,currency,effective_from,effective_to,status,region_code,region_name,city_name,area_name,fare_scope,distance_min_km,distance_max_km,passenger_type,notes,source_id(id,organization_name,source_url,title,published_at,effective_from,status,verification_note)");
    u.searchParams.set("status", "eq.active");
    u.searchParams.set("order", "effective_from.desc");
    u.searchParams.set("limit", "500");
    const r = await fetch(u, {
      cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error("database");
    const rows = await r.json();
    const now = Date.now();
    const sourceIsCurrent = (row: any) => {
      const note = String(row.source_id?.verification_note || "");
      if (/^Official/i.test(note)) return true;
      const published = row.source_id?.published_at ? Date.parse(row.source_id.published_at) : NaN;
      const effective = row.effective_from ? Date.parse(row.effective_from) : NaN;
      const anchor = Number.isFinite(published) ? published : effective;
      return Number.isFinite(anchor) && Date.now() - anchor <= 120 * 24 * 60 * 60 * 1000;
    };
    const active = rows.filter((row: any) => {
      const from = row.effective_from ? Date.parse(row.effective_from) : -Infinity;
      const to = row.effective_to ? Date.parse(row.effective_to) : Infinity;
      return row.status === "active" && from <= now && now <= to;
    });
    const current = active.filter(sourceIsCurrent);
    const official = current.filter((row: any) => /^Official/i.test(String(row.source_id?.verification_note || "")));
    const reported = current.filter((row: any) => !/^Official/i.test(String(row.source_id?.verification_note || "")));
    return NextResponse.json({
      ok: true,
      source: official.length ? "verified-database" : reported.length ? "reported-current-source" : "verified-database",
      verifiedFareRows: official.length,
      reportedFareRows: reported.length,
      fares: current,
      checkedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({ ok: false, source: "unavailable", message: "Tariff data is temporarily unavailable." }, { status: 502 });
  }
}
