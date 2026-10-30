import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const evidenceBucket = "complaint-evidence";
const storageKey = supabaseSecret || supabaseKey;
const MAX_FILES = 3;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const text = (value: unknown, max: number) => {
  if (value == null) return null;
  const v = String(value).trim();
  return v ? v.slice(0, max) : null;
};

const cityAuthority = (city: string) => {
  const map: Record<string,string> = {
    "አዲስ አበባ":"የአዲስ አበባ ትራንስፖርት ተጠሪ አካል",
    "ሀዋሳ":"የሀዋሳ ከተማ ትራንስፖርት ተጠሪ አካል",
    "ባህር ዳር":"የባህር ዳር ከተማ ትራንስፖርት ተጠሪ አካል",
    "ድሬዳዋ":"የድሬዳዋ ትራንስፖርት ተጠሪ አካል",
    "መቀሌ":"የመቀሌ ትራንስፖርት ተጠሪ አካል"
  };
  return map[city] || ("የ" + city + " ትራንስፖርት ተጠሪ አካል");
};

async function uploadEvidence(reference: string, files: File[]) {
  if (!files.length) return [];
  if (!supabaseUrl || !(supabaseSecret || supabaseKey)) throw new Error("Evidence storage is not configured.");
  const out: any[] = [];
  for (const file of files.slice(0, MAX_FILES)) {
    if (file.size > MAX_FILE_BYTES) throw new Error("Each evidence file must be 25 MB or smaller.");
    if (!/^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|webm|quicktime|3gpp))$/i.test(file.type)) {
      throw new Error("Only image or video evidence is allowed.");
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = reference + "/" + crypto.randomUUID() + "-" + safeName;
    const response = await fetch(supabaseUrl + "/storage/v1/object/" + evidenceBucket + "/" + path, {
      method: "POST",
      headers: {
        apikey: storageKey!,
        Authorization: "Bearer " + storageKey!,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false"
      },
      body: Buffer.from(await file.arrayBuffer())
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error("Evidence upload failed: " + detail.slice(0, 180));
    }
    out.push({ path, name: file.name, type: file.type, size: file.size });
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: any = {};
    const files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (key === "evidence" && value instanceof File) {
          files.push(value);
        } else {
          body[key] = String(value);
        }
      }
    } else {
      body = await request.json();
    }

    const description = text(body?.description, 4000);
    const city = text(body?.city, 160);
    const plate = text(body?.plate, 80);

    if (!description || description.length < 5) return NextResponse.json({ error: "Description is required." }, { status: 400 });
    if (!city) return NextResponse.json({ error: "City is required." }, { status: 400 });
    if (!plate) return NextResponse.json({ error: "Vehicle plate is required." }, { status: 400 });

    const latitudeValue = body?.latitude;
    const longitudeValue = body?.longitude;
    const latitude = latitudeValue == null || latitudeValue === "" ? null : Number(latitudeValue);
    const longitude = longitudeValue == null || longitudeValue === "" ? null : Number(longitudeValue);

    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return NextResponse.json({ error: "Invalid latitude." }, { status: 400 });
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return NextResponse.json({ error: "Invalid longitude." }, { status: 400 });

    const reference = text(body?.reference, 80) || "ET-" + Date.now();
    let authorityName = cityAuthority(city);
    let authorityConfigured = false;
    let authorityEndpoint = "";
    if (supabaseUrl && supabaseKey) {
      try {
        const lookup = await fetch(supabaseUrl + "/rest/v1/transport_complaint_authorities?city_name=eq." + encodeURIComponent(city) + "&active=eq.true&select=authority_name,endpoint_url&limit=1", { headers: { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey }, cache: "no-store" });
        if (lookup.ok) {
          const rows = await lookup.json();
          if (Array.isArray(rows) && rows[0]) {
            authorityName = rows[0].authority_name || authorityName;
            authorityConfigured = true;
            authorityEndpoint = rows[0].endpoint_url || "";
          }
        }
      } catch {}
    }
    const evidence = await uploadEvidence(reference, files);

    const record: any = {
      reference,
      name: text(body?.name, 120),
      phone: text(body?.phone, 40),
      city_name: city,
      vehicle_plate: plate,
      category: text(body?.category, 120),
      location: text(body?.location, 300),
      description,
      latitude,
      longitude,
      evidence,
      status: "received",
      routed_authority_name: authorityName,
      delivery_status: authorityConfigured ? "routed" : "pending_official_submission",
      routed_at: authorityConfigured ? new Date().toISOString() : null,
      last_status_at: new Date().toISOString()
    };

    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Complaint storage is not configured; the report was not saved." }, { status: 503 });

    const saveResponse = await fetch(supabaseUrl + "/rest/v1/transport_complaints", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: supabaseKey,
        Authorization: "Bearer " + supabaseKey,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(record),
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });

    if (!saveResponse.ok) {
      const detail = await saveResponse.text();
      return NextResponse.json({ error: "Could not save the report.", detail: detail.slice(0, 300) }, { status: 502 });
    }

    let delivered = false;
    let deliveryStatus = authorityConfigured ? "routed" : "pending_official_submission";
    let deliveryError: string | null = null;
    const webhook = authorityEndpoint || process.env.TRANSPORT_COMPLAINT_WEBHOOK_URL;

    if (webhook) {
      try {
        const notification = await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...record, product: "ETHIO TRANSPORT", evidence }),
          signal: AbortSignal.timeout(10000)
        });
        delivered = notification.ok;
        deliveryStatus = notification.ok ? "delivered" : "failed";
        if (!notification.ok) deliveryError = (await notification.text()).slice(0, 300);
      } catch {
        deliveryStatus = "failed";
        deliveryError = "Official endpoint could not be reached.";
      }
    }

    if (supabaseSecret) {
      try {
        await fetch(supabaseUrl + "/rest/v1/transport_complaints?reference=eq." + encodeURIComponent(reference), {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            apikey: supabaseSecret,
            Authorization: "Bearer " + supabaseSecret,
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            delivery_status: deliveryStatus,
            delivered_at: delivered ? new Date().toISOString() : null
          })
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      reference,
      delivered,
      persisted: true,
      authority: authorityName,
      evidenceCount: evidence.length,
      deliveryStatus
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Invalid report request." }, { status: 400 });
  }
}
