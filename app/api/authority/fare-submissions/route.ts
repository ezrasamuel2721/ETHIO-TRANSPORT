import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

function unauthorized() {
  return NextResponse.json({ error: "Authority authentication required." }, { status: 401 });
}

async function getAuthority(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || !supabaseUrl || !supabaseKey) return null;
  const response = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { apikey: supabaseKey, Authorization: auth },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (user?.app_metadata?.role !== "authority") return null;
  const regionCode = String(user?.app_metadata?.region_code || "").trim().toUpperCase();
  if (!regionCode) return null;
  return {
    id: String(user.id),
    name: String(user?.app_metadata?.authority_name || user?.email || "Transport Authority"),
    regionCode,
    regionName: String(user?.app_metadata?.region_name || regionCode),
    authorization: auth,
  };
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const authority = await getAuthority(request);
  if (!authority || !supabaseUrl || !supabaseKey) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const query = new URLSearchParams({
    select: "id,authority_name,region_code,region_name,service_type,vehicle_category,rate_per_km,base_fare,minimum_fare,fixed_fare,currency,fare_scope,city_name,area_name,distance_min_km,distance_max_km,passenger_type,notes,source_document_url,source_document_title,source_reference,effective_from,effective_to,status,rejection_reason,reviewed_at,published_at,created_at,updated_at",
    authority_user_id: "eq." + authority.id,
    order: "created_at.desc",
    limit: "100",
  });
  if (status && ["active","expired"].includes(status)) query.set("status", "eq." + status);

  const response = await fetch(supabaseUrl + "/rest/v1/authority_fare_submissions?" + query.toString(), {
    headers: { apikey: supabaseKey, Authorization: authority.authorization },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return bad("Could not load authority submissions.", 502);
  return NextResponse.json({
    authority: { name: authority.name, regionCode: authority.regionCode, regionName: authority.regionName },
    submissions: await response.json(),
  });
}

export async function POST(request: Request) {
  const authority = await getAuthority(request);
  if (!authority || !supabaseUrl || !supabaseKey) return unauthorized();

  try {
    const body = await request.json();
    const serviceType = String(body?.serviceType || "").trim();
    const fareScope = String(body?.fareScope || "regional").trim();
    const vehicleCategory = String(body?.vehicleCategory || "").trim().slice(0, 160) || null;
    const sourceDocumentUrl = String(body?.sourceDocumentUrl || "").trim().slice(0, 1000) || null;
    const sourceDocumentTitle = String(body?.sourceDocumentTitle || "").trim().slice(0, 300) || null;
    const sourceReference = String(body?.sourceReference || "").trim().slice(0, 300) || null;

    if (!["bus","taxi","rail","other"].includes(serviceType)) return bad("Choose a valid service type.");
    if (!["national","regional","city","area","route"].includes(fareScope)) return bad("Choose a valid fare scope.");

    const fixedFare = numberOrNull(body?.fixedFare);
    const ratePerKm = numberOrNull(body?.ratePerKm);
    const baseFare = numberOrNull(body?.baseFare);
    const minimumFare = numberOrNull(body?.minimumFare);
    const minKm = numberOrNull(body?.distanceMinKm);
    const maxKm = numberOrNull(body?.distanceMaxKm);

    if (fixedFare === null && ratePerKm === null) return bad("Enter either a fixed fare or a fare-per-kilometre rate.");
    if (fixedFare !== null && fixedFare < 0) return bad("Fixed fare cannot be negative.");
    if (ratePerKm !== null && ratePerKm < 0) return bad("Rate per kilometre cannot be negative.");
    if (minKm !== null && minKm < 0) return bad("Minimum distance cannot be negative.");
    if (minKm !== null && maxKm !== null && maxKm < minKm) return bad("Maximum distance must be greater than or equal to minimum distance.");

    const payload = {
      authority_user_id: authority.id,
      authority_name: authority.name,
      region_code: authority.regionCode,
      region_name: authority.regionName,
      service_type: serviceType,
      vehicle_category: vehicleCategory,
      rate_per_km: ratePerKm,
      base_fare: baseFare,
      minimum_fare: minimumFare,
      fixed_fare: fixedFare,
      currency: "ETB",
      fare_scope: fareScope,
      city_name: String(body?.cityName || "").trim().slice(0, 160) || null,
      area_name: String(body?.areaName || "").trim().slice(0, 160) || null,
      distance_min_km: minKm,
      distance_max_km: maxKm,
      passenger_type: String(body?.passengerType || "").trim().slice(0, 120) || null,
      notes: String(body?.notes || "").trim().slice(0, 2000) || null,
      source_document_url: sourceDocumentUrl,
      source_document_title: sourceDocumentTitle,
      source_reference: sourceReference,
      effective_from: body?.effectiveFrom ? new Date(body.effectiveFrom).toISOString() : null,
      effective_to: body?.effectiveTo ? new Date(body.effectiveTo).toISOString() : null,
      status: "active",
    };

    const response = await fetch(supabaseUrl + "/rest/v1/authority_fare_submissions", {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: authority.authorization,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return bad((await response.text().catch(() => "")) || "The authority submission could not be saved.", 502);
    const rows = await response.json();
    return NextResponse.json({ ok: true, submission: rows?.[0] || null }, { status: 201 });
  } catch {
    return bad("Invalid authority fare submission.", 400);
  }
}
