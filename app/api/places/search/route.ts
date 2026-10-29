import { NextRequest, NextResponse } from "next/server";

type Place = {
  id: string;
  canonical_name: string;
  name_am?: string | null;
  name_om?: string | null;
  name_en?: string | null;
  aliases?: string[];
  place_type: string;
  region_code?: string | null;
  region_name?: string | null;
  city_name?: string | null;
  sub_city_name?: string | null;
  woreda_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_name: string;
  source_url?: string | null;
  confidence: number;
  last_verified_at?: string;
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[’']/g, "")
    .replace(/[-_/.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function regionFromAddress(address: Record<string, string> = {}, display = "") {
  const text = Object.values(address).join(" ") + " " + display;
  const patterns: Array<[string, RegExp]> = [
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
  return patterns.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function mapRow(row: any): Place {
  return {
    id: row.id,
    canonical_name: row.canonical_name,
    name_am: row.name_am,
    name_om: row.name_om,
    name_en: row.name_en,
    aliases: row.aliases || [],
    place_type: row.place_type,
    region_code: row.region_code,
    region_name: row.region_name,
    city_name: row.city_name,
    sub_city_name: row.sub_city_name,
    woreda_name: row.woreda_name,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    source_name: row.source_name,
    source_url: row.source_url,
    confidence: Number(row.confidence ?? 0.5),
    last_verified_at: row.last_verified_at,
  };
}

async function searchDatabase(query: string, base: string, key: string) {
  const normalized = normalize(query);
  const url = new URL("/rest/v1/transport_places", base);
  url.searchParams.set(
    "select",
    "id,canonical_name,name_am,name_om,name_en,aliases,place_type,region_code,region_name,city_name,sub_city_name,woreda_name,latitude,longitude,source_name,source_url,confidence,last_verified_at"
  );
  url.searchParams.set("active", "eq.true");
  url.searchParams.set("limit", "12");
  const encoded = encodeURIComponent(normalized);
  url.searchParams.set(
    "or",
    `normalized_name.eq.${encoded},canonical_name.ilike.*${encoded}*,name_en.ilike.*${encoded}*,name_am.ilike.*${encoded}*`
  );
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 300 },
  });
  if (!response.ok) return [];
  return (await response.json()).map(mapRow);
}

async function geocode(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query + ", Ethiopia");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "et");
  const response = await fetch(url, {
    headers: { "User-Agent": "ETHIO-TRANSPORT/1.0 (public transport place index)" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  return await response.json();
}

export async function GET(request: NextRequest) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2 || q.length > 180) return json({ error: "Search text must be 2–180 characters." }, 400);

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return json({ error: "Place index is not configured." }, 503);

  try {
    const existing = await searchDatabase(q, base, key);
    if (existing.length) return json({ query: q, results: existing, source: "transport_places" });

    const rows = await geocode(q);
    const places: Place[] = [];
    for (const row of rows) {
      const address = row.address || {};
      const regionCode = regionFromAddress(address, row.display_name || "");
      const city = address.city || address.town || address.municipality || address.village || null;
      const subCity = address.suburb || address.neighbourhood || null;
      const woreda = address.city_district || address.district || null;
      const canonical = String(address.neighbourhood || address.suburb || address.village || address.town || address.city || row.display_name || q);
      const names = [canonical, q, address.neighbourhood, address.suburb, address.village, address.town, address.city]
        .filter(Boolean)
        .map(String);
      const dedup = Array.from(new Set(names));
      const normalized = normalize(canonical);

      const insertUrl = new URL("/rest/v1/transport_places", base);
      const payload = {
        canonical_name: canonical,
        name_en: address.neighbourhood || address.suburb || address.village || address.town || address.city || canonical,
        normalized_name: normalized,
        aliases: dedup,
        place_type: address.neighbourhood ? "neighborhood" : address.suburb ? "suburb" : address.woreda ? "woreda" : address.city ? "city" : "locality",
        region_code: regionCode,
        region_name: address.state || address.region || null,
        city_name: city,
        sub_city_name: subCity,
        woreda_name: woreda,
        latitude: Number(row.lat),
        longitude: Number(row.lon),
        source_name: "OpenStreetMap Nominatim",
        source_url: "https://nominatim.openstreetmap.org/",
        source_reference: row.osm_id ? `osm:${row.osm_type || "object"}:${row.osm_id}` : null,
        confidence: Number(row.type === "neighbourhood" ? 0.95 : row.type === "suburb" ? 0.9 : 0.8),
        active: true,
        last_verified_at: new Date().toISOString(),
      };

      const insertResponse = await fetch(insertUrl, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation,resolution=merge-duplicates",
        },
        body: JSON.stringify(payload),
      });
      if (insertResponse.ok) {
        const inserted = await insertResponse.json();
        if (inserted?.[0]) places.push(mapRow(inserted[0]));
      }
    }

    return json({
      query: q,
      results: places,
      source: places.length ? "geocoder+transport_places" : "none",
      message: places.length
        ? "Place recognized and added to the national place index."
        : "No verified Ethiopian place match was returned.",
    }, places.length ? 200 : 404);
  } catch {
    return json({ error: "Place search is temporarily unavailable." }, 503);
  }
}
