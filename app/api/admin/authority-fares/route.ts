import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const STATUSES = new Set(["submitted","reviewing","approved","rejected","published","expired"]);

async function getReviewer(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || !supabaseUrl || !supabaseKey) return null;
  const response = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { apikey: supabaseKey, Authorization: auth },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const user = await response.json();
  const role = user?.app_metadata?.role;
  if (role !== "reviewer" && role !== "admin") return null;
  return { id: String(user.id), authorization: auth };
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const reviewer = await getReviewer(request);
  if (!reviewer || !supabaseUrl || !supabaseKey) return fail("Reviewer authentication required.", 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "submitted";
  const query = new URLSearchParams({
    select: "id,authority_user_id,authority_name,region_code,region_name,service_type,vehicle_category,rate_per_km,base_fare,minimum_fare,fixed_fare,currency,fare_scope,city_name,area_name,distance_min_km,distance_max_km,passenger_type,notes,source_document_url,source_document_title,source_reference,effective_from,effective_to,status,rejection_reason,reviewed_by,reviewed_at,published_at,created_at,updated_at",
    order: "created_at.asc",
    limit: "100",
  });
  if (STATUSES.has(status)) query.set("status", "eq." + status);

  const response = await fetch(supabaseUrl + "/rest/v1/authority_fare_submissions?" + query.toString(), {
    headers: { apikey: supabaseKey, Authorization: reviewer.authorization },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return fail("Could not load authority fare submissions.", 502);
  return NextResponse.json({ status, submissions: await response.json() });
}

export async function PATCH(request: Request) {
  const reviewer = await getReviewer(request);
  if (!reviewer || !supabaseUrl || !supabaseKey) return fail("Reviewer authentication required.", 401);

  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const nextStatus = String(body?.status || "").trim();
    const reason = String(body?.rejectionReason || "").trim().slice(0, 1200) || null;
    if (!id || !STATUSES.has(nextStatus)) return fail("Submission id and valid status are required.");

    const readUrl = new URL("/rest/v1/authority_fare_submissions", supabaseUrl);
    readUrl.searchParams.set("select", "id,status");
    readUrl.searchParams.set("id", "eq." + id);
    readUrl.searchParams.set("limit", "1");
    const read = await fetch(readUrl, {
      headers: { apikey: supabaseKey, Authorization: reviewer.authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!read.ok) return fail("Could not read the submission.", 502);
    const existing = await read.json();
    if (!existing?.[0]) return fail("Submission not found.", 404);

    const current = String(existing[0].status);
    const transitions: Record<string,string[]> = {
      submitted: ["reviewing","rejected"],
      reviewing: ["approved","rejected"],
      approved: ["published","rejected"],
      rejected: ["reviewing"],
      published: ["expired"],
      expired: [],
    };
    if (nextStatus !== current && !transitions[current]?.includes(nextStatus)) {
      return fail("Invalid status transition: " + current + " → " + nextStatus + ".");
    }

    const updateUrl = new URL("/rest/v1/authority_fare_submissions", supabaseUrl);
    updateUrl.searchParams.set("id", "eq." + id);
    const response = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: reviewer.authorization,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: nextStatus,
        rejection_reason: nextStatus === "rejected" ? reason : null,
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return fail("Could not update the submission.", 502);
    const rows = await response.json();
    return NextResponse.json({ ok: true, submission: rows?.[0] || null });
  } catch {
    return fail("Invalid reviewer request.", 400);
  }
}
