import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return NextResponse.json({ error: "Fare evidence service is not configured." }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const allowed = ["official_web","official_pdf","official_api","official_document","authorized_operator","manual_report","other"];
  const sourceType = String(body.sourceType || "manual_report");
  if (!allowed.includes(sourceType)) return NextResponse.json({ error: "Unsupported source type." }, { status: 400 });
  const serviceType = body.serviceType ? String(body.serviceType) : null;
  if (serviceType && !["bus","taxi","rail","other"].includes(serviceType)) return NextResponse.json({ error: "Unsupported service type." }, { status: 400 });
  const payload = {
    source_type: sourceType,
    organization_name: body.organizationName ? String(body.organizationName).slice(0,200) : null,
    source_url: body.sourceUrl ? String(body.sourceUrl).slice(0,2000) : null,
    document_title: body.documentTitle ? String(body.documentTitle).slice(0,500) : null,
    document_date: body.documentDate || null,
    region_code: body.regionCode ? String(body.regionCode).toUpperCase().slice(0,8) : null,
    city_name: body.cityName ? String(body.cityName).slice(0,160) : null,
    service_type: serviceType,
    vehicle_category: body.vehicleCategory ? String(body.vehicleCategory).slice(0,160) : null,
    fare_text: body.fareText ? String(body.fareText).slice(0,3000) : null,
    distance_min_km: Number.isFinite(Number(body.distanceMinKm)) ? Number(body.distanceMinKm) : null,
    distance_max_km: Number.isFinite(Number(body.distanceMaxKm)) ? Number(body.distanceMaxKm) : null,
    rate_per_km: Number.isFinite(Number(body.ratePerKm)) ? Number(body.ratePerKm) : null,
    base_fare: Number.isFinite(Number(body.baseFare)) ? Number(body.baseFare) : null,
    minimum_fare: Number.isFinite(Number(body.minimumFare)) ? Number(body.minimumFare) : null,
    fixed_fare: Number.isFinite(Number(body.fixedFare)) ? Number(body.fixedFare) : null,
    currency: String(body.currency || "ETB").slice(0,12),
    effective_from: body.effectiveFrom || null,
    effective_to: body.effectiveTo || null,
    notes: body.notes ? String(body.notes).slice(0,3000) : null,
    evidence_hash: body.evidenceHash ? String(body.evidenceHash).slice(0,128) : null,
    review_status: "pending",
    created_by: body.createdBy ? String(body.createdBy).slice(0,160) : null
  };
  if (!payload.fare_text && payload.fixed_fare == null && payload.rate_per_km == null && payload.base_fare == null) return NextResponse.json({ error: "Provide fare evidence text or a fare value." }, { status: 400 });
  const response = await fetch(new URL("/rest/v1/transport_fare_evidence", base), {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) return NextResponse.json({ error: "Could not store fare evidence." }, { status: 502 });
  const rows = await response.json();
  return NextResponse.json({ accepted: true, reviewStatus: "pending", evidence: rows?.[0] || null }, { status: 201 });
}

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return NextResponse.json({ error: "Fare evidence service is not configured." }, { status: 503 });
  const url = new URL("/rest/v1/transport_fare_evidence", base);
  url.searchParams.set("select", "id,submitted_at,source_type,organization_name,source_url,document_title,document_date,region_code,city_name,service_type,vehicle_category,fare_text,distance_min_km,distance_max_km,rate_per_km,base_fare,minimum_fare,fixed_fare,currency,effective_from,effective_to,notes,review_status,reviewed_at");
  url.searchParams.set("review_status", "eq.verified");
  url.searchParams.set("order", "submitted_at.desc");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key }, cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Could not read verified fare evidence." }, { status: 502 });
  return NextResponse.json({ evidence: await response.json() });
}
