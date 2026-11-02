import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const AUTHORIZED_COOKIE = "ethio_transport_authorized";
const OWNER_COOKIE = "ethio_transport_owner";

function customerRefsFromEnv(key: string) {
  return (process.env[key] || "").split(",").map(value => value.trim()).filter(Boolean);
}
function isOwnerCustomerRef(customerRef: string) {
  return customerRefsFromEnv("ETHIO_TRANSPORT_OWNER_CUSTOMER_REFS").includes(customerRef);
}
function isAuthorizedCustomerRef(customerRef: string) {
  return customerRefsFromEnv("ETHIO_TRANSPORT_AUTHORIZED_CUSTOMER_REFS").includes(customerRef);
}
function validSignedCookie(request: NextRequest, customerRef: string, cookieName: string, secret: string) {
  const token = request.cookies.get(cookieName)?.value || "";
  if (!/^[a-f0-9]{64}$/i.test(secret) || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = createHmac("sha256", Buffer.from(secret, "hex")).update(customerRef, "utf8").digest();
  const supplied = Buffer.from(token, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function GET(request: NextRequest) {
  const customerRef = request.nextUrl.searchParams.get("customerRef") || "";
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(customerRef)) {
    return NextResponse.json({ error: "Invalid customer reference." }, { status: 400 });
  }

  const ownerSecret = process.env.ETHIO_TRANSPORT_OWNER_ACTIVATION_CODE_HASH || "";
  const owner = isOwnerCustomerRef(customerRef) ||
    validSignedCookie(request, customerRef, OWNER_COOKIE, ownerSecret);
  if (owner) {
    return NextResponse.json({
      active: true, owner: true, authorized: true,
      membership: { plan_code: "owner", status: "active", starts_at: null, expires_at: null, amount: 0, currency: "ETB" },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const authorizedSecret = process.env.ETHIO_TRANSPORT_AUTHORIZED_ACCESS_CODE_HASH || "";
  const authorized = isAuthorizedCustomerRef(customerRef) ||
    validSignedCookie(request, customerRef, AUTHORIZED_COOKIE, authorizedSecret);
  if (authorized) {
    return NextResponse.json({
      active: true, owner: false, authorized: true,
      membership: { plan_code: "authorized", status: "active", starts_at: null, expires_at: null, amount: 0, currency: "ETB" },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabaseBase = process.env.SUPABASE_URL;
    if (!supabaseBase) throw new Error("Supabase URL is not configured.");
    const base = supabaseBase.endsWith("/") ? supabaseBase.slice(0, -1) : supabaseBase;
    const functionUrl = base + "/functions/v1/transport-membership-status?customerRef=" + encodeURIComponent(customerRef);
    let responseData: any = null;
    let lastError = "Membership service failed.";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(functionUrl, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
        const raw = await response.text();
        if (!response.ok) {
          lastError = "Membership service failed: " + response.status;
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
          continue;
        }
        responseData = raw ? JSON.parse(raw) : { membership: null };
        break;
      } catch (error: any) {
        lastError = error?.message || lastError;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
      }
    }
    if (responseData === null) throw new Error(lastError);
    const membership = responseData?.membership ?? null;
    const dbOwner = membership?.plan_code === "owner" && membership?.status === "active";
    const active = Boolean(dbOwner || (
      membership?.status === "active" && membership?.expires_at &&
      new Date(String(membership.expires_at)).getTime() > Date.now()
    ));
    return NextResponse.json({ active, owner: dbOwner, authorized: dbOwner, membership }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Membership status unavailable." }, { status: 503 });
  }
}
