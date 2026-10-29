import { NextRequest, NextResponse } from "next/server";

type Point = { lat: number; lon: number; display?: string; address?: Record<string,string> };

const REGION_PATTERNS: Array<[string, RegExp]> = [
  ["AA", /addis ababa|አዲስ አበባ|finfinne/i],
  ["DD", /dire dawa|ድሬዳዋ/i],
  ["AF", /afar|አፋር/i],
  ["AM", /amhara|አማራ/i],
  ["BE", /benishangul|gumuz|ቤንሻንጉል/i],
  ["CE", /central ethiopia|central region|ማዕከላዊ ኢትዮጵያ/i],
  ["GA", /gambella|ጋምቤላ/i],
  ["HA", /harari|harar|ሐረሪ/i],
  ["OR", /oromia|ኦሮሚያ/i],
  ["SD", /sidama|ሲዳማ/i],
  ["SO", /somali|ሶማሌ/i],
  ["SE", /south ethiopia|southern ethiopia|ደቡብ ኢትዮጵያ/i],
  ["SW", /south west ethiopia|southwest ethiopia|ደቡብ ምዕራብ/i],
  ["TG", /tigray|ትግራይ/i],
];

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function regionFromAddress(address: Record<string,string> = {}, display = "") {
  const text = Object.values(address).join(" ") + " " + display;
  return REGION_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function normalizePlace(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC").replace(/[’']/g, "").replace(/[-_/.,()]/g, " ").replace(/\\s+/g, " ").trim();
}

async function geocode(query: string): Promise<Point | null> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (base && key) {
    const normalized = normalizePlace(query);
    const cachedUrl = new URL("/rest/v1/transport_places", base);
    cachedUrl.searchParams.set("select", "canonical_name,name_en,name_am,name_om,aliases,latitude,longitude,region_code,region_name,city_name,sub_city_name,woreda_name,source_name,source_url,confidence,last_verified_at");
    cachedUrl.searchParams.set("active", "eq.true");
    cachedUrl.searchParams.set("limit", "5");
    cachedUrl.searchParams.set("or", `normalized_name.eq.${encodeURIComponent(normalized)},canonical_name.ilike.*${encodeURIComponent(normalized)}*,name_en.ilike.*${encodeURIComponent(normalized)}*`);
    const cachedResponse = await fetch(cachedUrl, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (cachedResponse.ok) {
      const cached = await cachedResponse.json();
      const best = cached?.[0];
      if (best && Number.isFinite(Number(best.latitude)) && Number.isFinite(Number(best.longitude))) {
        return {
          lat: Number(best.latitude),
          lon: Number(best.longitude),
          display: best.canonical_name || best.name_en || query,
          address: {
            state: best.region_name || "",
            city: best.city_name || "",
            suburb: best.sub_city_name || "",
            city_district: best.woreda_name || "",
          },
        };
      }
    }
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query + ", Ethiopia");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "et");
  const response = await fetch(url, {
    headers: { "User-Agent": "ETHIO-TRANSPORT/1.0 (public transport fare search)" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const rows = await response.json();
  const row = rows?.[0];
  if (!row) return null;

  if (base && key) {
    const address = row.address || {};
    const regionCode = regionFromAddress(address, row.display_name || "");
    const canonical = String(address.neighbourhood || address.suburb || address.village || address.town || address.city || row.display_name || query);
    const aliases = Array.from(new Set([query, canonical, address.neighbourhood, address.suburb, address.village, address.town, address.city].filter(Boolean).map(String)));
    const insertUrl = new URL("/rest/v1/transport_places", base);
    void fetch(insertUrl, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({
        canonical_name: canonical,
        name_en: canonical,
        normalized_name: normalizePlace(canonical),
        aliases,
        place_type: address.neighbourhood ? "neighborhood" : address.suburb ? "suburb" : address.city ? "city" : "locality",
        region_code: regionCode,
        region_name: address.state || address.region || null,
        city_name: address.city || address.town || address.municipality || address.village || null,
        sub_city_name: address.suburb || address.neighbourhood || null,
        woreda_name: address.city_district || address.district || null,
        latitude: Number(row.lat),
        longitude: Number(row.lon),
        source_name: "OpenStreetMap Nominatim",
        source_url: "https://nominatim.openstreetmap.org/",
        source_reference: row.osm_id ? `osm:${row.osm_type || "object"}:${row.osm_id}` : null,
        confidence: Number(row.type === "neighbourhood" ? 0.95 : row.type === "suburb" ? 0.9 : 0.8),
        active: true,
        last_verified_at: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  }

  return {
    lat: Number(row.lat),
    lon: Number(row.lon),
    display: row.display_name,
    address: row.address || {},
  };
}

async function roadDistance(a: Point, b: Point) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&steps=false`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const data = await response.json();
  const route = data?.routes?.[0];
  return route ? {
    distanceKm: Number(route.distance) / 1000,
    durationMinutes: Number(route.duration) / 60,
  } : null;
}

function activeNow(row: any) {
  const now = Date.now();
  const from = row.effective_from ? Date.parse(row.effective_from) : -Infinity;
  const to = row.effective_to ? Date.parse(row.effective_to) : Infinity;
  return row.status === "active" && from <= now && now <= to;
}

function matchesDistance(row: any, km: number) {
  const min = row.distance_min_km == null ? 0 : Number(row.distance_min_km);
  const max = row.distance_max_km == null ? Infinity : Number(row.distance_max_km);
  return km >= min && km <= max;
}

function calculateFare(row: any, km: number) {
  const fixed = Number(row.fixed_fare);
  if (Number.isFinite(fixed)) return fixed;
  const base = Number(row.base_fare || 0);
  const rate = Number(row.rate_per_km);
  if (!Number.isFinite(rate)) return null;
  const raw = base + km * rate;
  const minimum = Number(row.minimum_fare);
  return Number.isFinite(minimum) ? Math.max(raw, minimum) : raw;
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const origin = (params.get("origin") || "").trim();
  const destination = (params.get("destination") || "").trim();
  const requestedRegion = (params.get("regionCode") || "").trim().toUpperCase();

  if (!origin || !destination) return json({ error: "Origin and destination are required." }, 400);
  if (origin.length > 180 || destination.length > 180) return json({ error: "Location text is too long." }, 400);
  if (origin.toLowerCase() === destination.toLowerCase()) return json({ error: "Origin and destination must be different." }, 400);

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return json({ error: "Fare database is not configured." }, 503);

  try {
    const [a, b] = await Promise.all([geocode(origin), geocode(destination)]);
    if (!a || !b) return json({ error: "One or both locations could not be found in Ethiopia." }, 404);

    const route = await roadDistance(a, b);
    if (!route) {
      return json({
        error: "Road distance could not be calculated. No fare was selected because a distance-based fare must not be guessed.",
        source: "route-unavailable",
      }, 503);
    }

    const distanceKm = Number(route.distanceKm.toFixed(2));
    const originRegion = regionFromAddress(a.address, a.display);
    const destinationRegion = regionFromAddress(b.address, b.display);
    const sameRegion = Boolean(originRegion && destinationRegion && originRegion === destinationRegion);
    const regionCode = requestedRegion || (sameRegion ? originRegion : null);
    if (!sameRegion && !requestedRegion) {
      return json({
        origin: { query: origin, display: a.display, regionCode: originRegion, lat: a.lat, lon: a.lon },
        destination: { query: destination, display: b.display, regionCode: destinationRegion, lat: b.lat, lon: b.lon },
        sameRegion: false,
        needsRegionSelection: true,
        regionOptions: [originRegion, destinationRegion].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i),
        distanceKm,
        durationMinutes: Math.round(route.durationMinutes),
        fares: [],
        checkedAt: new Date().toISOString(),
      });
    }

    // Public fare results are authority-only until the required official data-sharing
    // agreement is in place. Legacy/secondary transport_fares rows are deliberately
    // not returned to users, even if they are marked active in the database.
    // The authority workflow is the only public source for current fares.
    const authorityUrl = new URL("/rest/v1/authority_fare_submissions", base);\n    authorityUrl.searchParams.set("select", "id,authority_user_id,authority_name,region_code,region_name,service_type,vehicle_category,rate_per_km,base_fare,minimum_fare,fixed_fare,currency,fare_scope,city_name,area_name,distance_min_km,distance_max_km,passenger_type,notes,source_document_url,source_document_title,source_reference,effective_from,effective_to,status,published_at");\n    authorityUrl.searchParams.set("status", "eq.published");\n    authorityUrl.searchParams.set("order", "published_at.desc");\n    authorityUrl.searchParams.set("limit", "500");\n\n    const authorityResponse = await fetch(authorityUrl, {\n      headers: { apikey: key, Authorization: \`Bearer \${key}\` },\n      cache: "no-store",\n      signal: AbortSignal.timeout(8000),\n    });\n    const authorityRows = authorityResponse.ok\n      ? (await authorityResponse.json())\n          .filter((row: any) => {\n            const from = row.effective_from ? Date.parse(row.effective_from) : -Infinity;\n            const to = row.effective_to ? Date.parse(row.effective_to) : Infinity;\n            return from <= Date.now() && Date.now() <= to;\n          })\n          .filter((row: any) => !regionCode || row.region_code === regionCode)\n          .map((row: any) => ({\n            ...row,\n            __authorityPublished: true,\n            source_id: {\n              id: row.id,\n              organization_name: row.authority_name,\n              source_url: row.source_document_url || "",\n              title: row.source_document_title || "Authority-published tariff",\n              published_at: row.published_at,\n              effective_from: row.effective_from,\n              status: "active",\n              verification_note: "Official authority submission • reviewed and published by ETHIO TRANSPORT.",\n            },\n          }))\n      : [];\n\n    const services = ["bus", "taxi", "rail"];
    const services = ["bus", "taxi", "rail"];\n    const results: any[] = [];

    for (const serviceType of services) {
      const candidates = [...authorityRows]
        .filter((row: any) => row.service_type === serviceType)
        .filter((row: any) => matchesDistance(row, distanceKm))
        .filter((row: any) => {
          if (row.city_name && a.address?.city && row.city_name.toLowerCase() !== String(a.address.city).toLowerCase()) return false;
          return true;
        })
        .map((row: any) => ({ ...row, calculated_fare: calculateFare(row, distanceKm) }))
        .filter((row: any) => row.calculated_fare != null)
        .sort((x: any, y: any) => {
          const xAuthority = Boolean(x.__authorityPublished);
          const yAuthority = Boolean(y.__authorityPublished);
          const xOfficial = /^Official/i.test(String(x.source_id?.verification_note || ""));
          const yOfficial = /^Official/i.test(String(y.source_id?.verification_note || ""));
          return Number(yAuthority) - Number(xAuthority) ||
            Number(yOfficial) - Number(xOfficial) ||
            Number(y.effective_from ? Date.parse(y.effective_from) : 0) -
            Number(x.effective_from ? Date.parse(x.effective_from) : 0);
        });

      if (candidates[0]) results.push(candidates[0]);
    }

    return json({
      origin: {
        query: origin,
        display: a.display,
        regionCode: originRegion,
        lat: a.lat,
        lon: a.lon,
      },
      destination: {
        query: destination,
        display: b.display,
        regionCode: destinationRegion,
        lat: b.lat,
        lon: b.lon,
      },
      sameRegion,
      regionCode,
      distanceKm,
      durationMinutes: Math.round(route.durationMinutes),
      fares: results,
      checkedAt: new Date().toISOString(),
      integrity: results.length
        ? "Only an active fare whose published distance band contains the calculated road distance is returned. Missing bands are never interpolated."
        : "No active published fare band covers this calculated road distance. No fare was invented or interpolated.",
    });
  } catch {
    return json({ error: "Quick fare search is temporarily unavailable." }, 503);
  }
}
