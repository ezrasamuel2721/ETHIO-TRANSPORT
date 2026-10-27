import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const ALLOWED_STATUSES = new Set(["detected", "reviewing", "verified", "rejected", "published"]);

function unauthorized() {
  return NextResponse.json({ error: "Reviewer authentication required." }, { status: 401 });
}

async function getReviewer(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  if (!supabaseUrl || !supabaseKey) return null;

  const response = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { apikey: supabaseKey, Authorization: auth },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;
  const user = await response.json();
  const role = user?.app_metadata?.role;
  if (role !== "reviewer" && role !== "admin") return null;

  return { id: String(user.id), role: String(role), authorization: auth };
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const reviewer = await getReviewer(request);
    if (!reviewer) return unauthorized();
    if (!supabaseUrl || !supabaseKey) return errorResponse("Supabase configuration is unavailable.", 503);

    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status");
    const status = requestedStatus && ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : "detected";

    const query = new URLSearchParams({
      select: "id,source_id,detected_at,previous_hash,new_hash,status,summary,reviewed_at,reviewed_by,created_at",
      status: "eq." + status,
      order: "detected_at.desc",
      limit: "100",
    });

    const response = await fetch(supabaseUrl + "/rest/v1/transport_change_events?" + query.toString(), {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return errorResponse("Could not load review items.", 502);
    const events = await response.json();
    return NextResponse.json({ reviewer, status, events });
  } catch {
    return errorResponse("Reviewer request failed.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const reviewer = await getReviewer(request);
    if (!reviewer) return unauthorized();
    if (!supabaseUrl || !supabaseKey) return errorResponse("Supabase configuration is unavailable.", 503);

    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";
    const summary = typeof body?.summary === "string" ? body.summary.trim().slice(0, 1000) : null;

    if (!id) return errorResponse("Change-event id is required.");
    if (!ALLOWED_STATUSES.has(status)) return errorResponse("Invalid review status.");

    const query = new URLSearchParams({ select: "id,status", id: "eq." + id, limit: "1" });
    const existingResponse = await fetch(supabaseUrl + "/rest/v1/transport_change_events?" + query.toString(), {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!existingResponse.ok) return errorResponse("Could not read the review item.", 502);

    const existing = await existingResponse.json();
    if (!Array.isArray(existing) || existing.length !== 1) return errorResponse("Review item not found.", 404);

    const current = String(existing[0].status);
    const allowedTransitions: Record<string, string[]> = {
      detected: ["reviewing", "rejected"],
      reviewing: ["verified", "rejected"],
      verified: ["published", "rejected"],
      rejected: ["reviewing"],
      published: [],
    };

    if (status !== current && !allowedTransitions[current]?.includes(status)) {
      return errorResponse("Invalid status transition: " + current + " → " + status + ".");
    }

    const payload = {
      status,
      ...(summary ? { summary } : {}),
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer.id,
    };

    const updateQuery = new URLSearchParams({ id: "eq." + id });
    const updateResponse = await fetch(supabaseUrl + "/rest/v1/transport_change_events?" + updateQuery.toString(), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        apikey: supabaseKey,
        Authorization: reviewer.authorization,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!updateResponse.ok) return errorResponse("Could not update the review item.", 502);
    const updated = await updateResponse.json();
    return NextResponse.json({ ok: true, event: updated?.[0] || null });
  } catch {
    return errorResponse("Invalid reviewer request.", 400);
  }
}
