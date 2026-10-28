import { NextRequest, NextResponse } from "next/server";

type Fare = Record<string, any>;
type CacheEntry = { expires: number; rows: Fare[] };
const memoryCache = new Map<string, CacheEntry>();
const CACHE_MS = 30_000;
const MAX_DB_ROWS = 500;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });

function activeNow(row: Fare) {
  const now = Date.now();
  const from = row.effective_from ? Date.parse(row.effective_from) : -Infinity;
  const to = row.effective_to ? Date.parse(row.effective_to) : Infinity;
  return row.status === "active" && from <= now && now <= to;
}

function distanceMatches(row: Fare, distanceKm: number | null) {
  if (distanceKm == null) return true;
  const min = row.distance_min_km == null ? 0 : Number(row.distance_min_km);
  const max = row.distance_max_km == null ? Infinity : Number(row.distance_max_km);
  return distanceKm >= min && distanceKm <= max;
}

function score(row: Fare, regionCode: string, city: string, area: string, distanceKm: number | null) {
  let s = 0;
  if (row.region_code === regionCode) s += 60;
  else if (!row.region_code) s += 20;
  else return -1;

  if (city) {
    if (String(row.city_name || "").trim().toLowerCase() === city.toLowerCase()) s += 30;
    else if (row.city_name) return -1;
  }
  if (area) {
    if (String(row.area_name || "").trim().toLowerCase() === area.toLowerCase()) s += 40;
    else if (row.area_name) return -1;
  }
  if (distanceKm != null) {
    if (distanceMatches(row, distanceKm)) s += 50;
    else if (row.distance_min_km != null || row.distance_max_km != null) return -1;
  }
  return s;
}

async function readDatabaseFares(base: string, key: string, serviceType: string) {
  const cacheKey = serviceType;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.rows;

  const url = new URL("/rest/v1/transport_fares", base);
  url.searchParams.set("select", "id,service_type,vehicle_category,rate_per_km,base_fare,minimum_fare,fixed_fare,currency,effective_from,effective_to,status,region_code,region_name,city_name,area_name,fare_scope,distance_min_km,distance_max_km,passenger_type,notes,source_id(id,organization_name,source_url,title,published_at,effective_from,status)");
  url.searchParams.set("service_type", `eq.${serviceType}`);
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("order", "effective_from.desc");
  url.searchParams.set("limit", String(MAX_DB_ROWS));

  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Could not read verified fare data.");
  const rows = (await response.json()).filter(activeNow);
  memoryCache.set(cacheKey, { expires: Date.now() + CACHE_MS, rows });
  return rows;
}

async function readAuthorizedEndpoint(requestUrl: string) {
  const endpoint = process.env.TRANSPORT_TARIFFS_URL;
  if (!endpoint) return [];
  try {
    const u = new URL(endpoint);
    const incoming = new URL(requestUrl).searchParams;
    for (const key of ["serviceType", "regionCode", "city", "area", "distanceKm"]) {
      const value = incoming.get(key);
      if (value) u.searchParams.set(key, value);
    }
    const response = await fetch(u, {
      headers: { Accept: "application/json", "User-Agent": "ETHIO-TRANSPORT/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = Array.isArray(data) ? data : data?.fares;
    return Array.isArray(rows) ? rows.filter(activeNow) : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const serviceType = (params.get("serviceType") || "bus").trim();
  const regionCode = (params.get("regionCode") || "").trim().toUpperCase();
  const city = (params.get("city") || "").trim();
  const area = (params.get("area") || "").trim();
  const distanceRaw = (params.get("distanceKm") || "").trim();
  const distanceKm = distanceRaw === "" ? null : Number(distanceRaw);

  if (!["bus", "taxi", "rail", "other"].includes(serviceType)) {
    return json({ error: "Unsupported service type." }, 400);
  }
  if (distanceKm !== null && (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 5000)) {
    return json({ error: "Distance must be a valid value from 0 to 5000 km." }, 400);
  }
  if (regionCode && !/^[A-Z]{2,4}$/.test(regionCode)) {
    return json({ error: "Invalid region code." }, 400);
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return json({ error: "Fare database is not configured." }, 503);

  try {
    const [databaseRows, authorizedRows] = await Promise.all([
      readDatabaseFares(base, key, serviceType),
      readAuthorizedEndpoint(request.url),
    ]);

    const candidates = [...databaseRows, ...authorizedRows].filter(activeNow);
    const ranked = candidates
      .map(row => ({ row, score: score(row, regionCode, city, area, distanceKm) }))
      .filter(x => x.score >= 0)
      .sort((a, b) =>
        b.score - a.score ||
        Date.parse(String(b.row.effective_from || 0)) - Date.parse(String(a.row.effective_from || 0))
      )
      .map(x => x.row);

    return json({
      serviceType,
      regionCode: regionCode || null,
      city: city || null,
      area: area || null,
      distanceKm,
      fares: ranked.slice(0, 20),
      source: authorizedRows.length ? "verified-database-and-authorized-provider" : "verified-database",
    });
  } catch (error: any) {
    return json({ error: error?.message || "Fare service is temporarily unavailable." }, 503);
  }
}
