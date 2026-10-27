import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function isSafeSourceUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h.endsWith(".local") ||
      h === "0.0.0.0" ||
      h === "::1" ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^169\.254\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
    ) return false;
    return true;
  } catch {
    return false;
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !secretKeysRaw) return json({ error: "Supabase secret configuration is unavailable." }, 503);

  let secretKey: string;
  try {
    secretKey = JSON.parse(secretKeysRaw)["default"];
  } catch {
    return json({ error: "Supabase secret configuration is invalid." }, 503);
  }
  if (!secretKey) return json({ error: "Supabase secret key is unavailable." }, 503);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: expected, error: secretError } = await admin.rpc("get_transport_monitor_secret");
  if (secretError || !expected) return json({ error: "Monitor authorization is unavailable." }, 503);

  const supplied = req.headers.get("x-transport-monitor-secret");
  if (!supplied || supplied !== expected) return json({ error: "Unauthorized." }, 401);

  const { data: sources, error: sourceError } = await admin
    .from("transport_sources")
    .select("id,organization_name,source_url,title,status")
    .eq("status", "active")
    .not("source_url", "is", null)
    .limit(50);

  if (sourceError) return json({ error: "Could not load monitored sources." }, 500);

  const results: Array<Record<string, unknown>> = [];

  for (const source of sources ?? []) {
    const sourceUrl = String(source.source_url || "");
    if (!isSafeSourceUrl(sourceUrl)) {
      await admin.from("transport_source_checks").insert({
        source_id: source.id,
        http_status: null,
        content_hash: null,
        content_length: null,
        changed: false,
        error_message: "Source URL is not an allowed public HTTP(S) URL.",
      });
      results.push({ sourceId: source.id, status: "rejected_url" });
      continue;
    }

    try {
      const response = await fetch(sourceUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "ETHIO-TRANSPORT Source Monitor/1.0",
          "Accept": "text/html,application/pdf,application/json,text/plain,*/*",
        },
      });

      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > 5_000_000) {
        await admin.from("transport_source_checks").insert({
          source_id: source.id,
          http_status: response.status,
          content_hash: null,
          content_length: declaredLength,
          changed: false,
          error_message: "Source response exceeds 5 MB monitoring limit.",
        });
        results.push({ sourceId: source.id, status: "too_large", httpStatus: response.status });
        continue;
      }

      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength > 5_000_000) {
        await admin.from("transport_source_checks").insert({
          source_id: source.id,
          http_status: response.status,
          content_hash: null,
          content_length: buffer.byteLength,
          changed: false,
          error_message: "Source response exceeds 5 MB monitoring limit.",
        });
        results.push({ sourceId: source.id, status: "too_large", httpStatus: response.status });
        continue;
      }

      const hash = await sha256Hex(buffer);
      const { data: previous } = await admin
        .from("transport_source_checks")
        .select("content_hash")
        .eq("source_id", source.id)
        .not("content_hash", "is", null)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const changed = Boolean(previous?.content_hash && previous.content_hash !== hash);

      await admin.from("transport_source_checks").insert({
        source_id: source.id,
        http_status: response.status,
        content_hash: hash,
        content_length: buffer.byteLength,
        changed,
        error_message: response.ok ? null : `Upstream returned HTTP ${response.status}.`,
      });

      if (changed) {
        await admin.from("transport_change_events").insert({
          source_id: source.id,
          previous_hash: previous?.content_hash ?? null,
          new_hash: hash,
          status: "detected",
          summary: `Content changed at ${source.organization_name || source.title || "monitored source"}.`,
        });
      }

      results.push({
        sourceId: source.id,
        status: changed ? "changed" : (response.ok ? "unchanged" : "http_error"),
        httpStatus: response.status,
        changed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "Source fetch failed.";
      await admin.from("transport_source_checks").insert({
        source_id: source.id,
        http_status: null,
        content_hash: null,
        content_length: null,
        changed: false,
        error_message: message,
      });
      results.push({ sourceId: source.id, status: "error", error: message });
    }
  }

  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    sourcesChecked: results.length,
    changesDetected: results.filter(r => r.changed === true).length,
    results,
  });
});
