import { NextResponse } from "next/server";

async function checkTable(base: string, key: string, table: string) {
  const url = new URL("/rest/v1/" + table, base);
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: "Bearer " + key },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  return response.ok;
}

export async function GET() {
  const started = Date.now();
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!base || !key) {
    return NextResponse.json(
      { ok: false, database: "not_configured", latencyMs: Date.now() - started },
      { status: 503 }
    );
  }

  try {
    // Public health checks intentionally cover read-only tables only.
    // complaints/trip_proofs accept INSERT but do not expose public SELECT,
    // so treating their RLS-protected read as a database outage would be false.
    const [sources, tickets, emergency, operators, routes, fares] = await Promise.all([
      checkTable(base, key, "transport_sources"),
      checkTable(base, key, "ticket_providers"),
      checkTable(base, key, "emergency_contacts"),
      checkTable(base, key, "transport_operators"),
      checkTable(base, key, "transport_routes"),
      checkTable(base, key, "transport_fares"),
    ]);

    const ok = sources && tickets && emergency && operators && routes && fares;

    return NextResponse.json(
      {
        ok,
        database: ok ? "reachable" : "degraded",
        checks: { sources, tickets, emergency, operators, routes, fares },
        write_endpoints: {
          complaints: "/api/complaints",
          trip_proofs: "/api/trip-proofs",
        },
        latencyMs: Date.now() - started,
      },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, database: "unavailable", latencyMs: Date.now() - started },
      { status: 503 }
    );
  }
}
