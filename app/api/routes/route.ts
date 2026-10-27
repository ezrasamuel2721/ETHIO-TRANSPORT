import { NextRequest, NextResponse } from "next/server";

type Point = { lat: number; lon: number; display?: string };

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function haversine(a: Point, b: Point) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function geocode(query: string): Promise<Point | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "et");
  const response = await fetch(url, {
    headers: { "User-Agent": "ETHIO-TRANSPORT/1.0 (public transport routing)" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json();
  const row = rows?.[0];
  return row ? { lat: Number(row.lat), lon: Number(row.lon), display: row.display_name } : null;
}

async function routeWithOsrm(a: Point, b: Point) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&steps=false`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json();
  const route = data?.routes?.[0];
  return route ? {
    distanceKm: Number(route.distance) / 1000,
    durationMinutes: Number(route.duration) / 60,
    provider: "OpenStreetMap / OSRM",
  } : null;
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const origin = (params.get("origin") || "").trim();
  const destination = (params.get("destination") || "").trim();
  if (!origin || !destination) return json({ error: "Origin and destination are required." }, 400);
  if (origin.length > 180 || destination.length > 180) return json({ error: "Location text is too long." }, 400);
  if (origin.toLowerCase() === destination.toLowerCase()) return json({ error: "Origin and destination must be different." }, 400);

  try {
    const [a, b] = await Promise.all([geocode(origin), geocode(destination)]);
    if (!a || !b) return json({ error: "One or both locations could not be found in Ethiopia." }, 404);

    const routed = await routeWithOsrm(a, b);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;

    if (routed) {
      return json({
        origin: a, destination: b,
        distanceKm: Number(routed.distanceKm.toFixed(2)),
        durationMinutes: Math.round(routed.durationMinutes),
        provider: routed.provider,
        estimated: false,
        mapsUrl,
      });
    }

    const estimatedKm = haversine(a, b);
    return json({
      origin: a, destination: b,
      distanceKm: Number(estimatedKm.toFixed(2)),
      durationMinutes: null,
      provider: "Geodesic fallback",
      estimated: true,
      mapsUrl,
    });
  } catch {
    return json({ error: "Route service is temporarily unavailable." }, 503);
  }
}
