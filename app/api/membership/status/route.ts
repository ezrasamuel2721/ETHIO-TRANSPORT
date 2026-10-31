import { NextRequest, NextResponse } from "next/server";

function isAuthorizedCustomerRef(customerRef: string) {
  const refs = (process.env.ETHIO_TRANSPORT_AUTHORIZED_CUSTOMER_REFS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return refs.includes(customerRef);
}

export async function GET(request: NextRequest) {
  const customerRef = request.nextUrl.searchParams.get("customerRef") || "";

  if (!/^[A-Za-z0-9_-]{16,80}$/.test(customerRef)) {
    return NextResponse.json({ error: "Invalid customer reference." }, { status: 400 });
  }

  if (isAuthorizedCustomerRef(customerRef)) {
    return NextResponse.json({
      active: true,
      owner: false,
      authorized: true,
      membership: {
        plan_code: "authorized",
        status: "active",
        starts_at: null,
        expires_at: null,
        amount: 0,
        currency: "ETB",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabaseBase = process.env.SUPABASE_URL;
    if (!supabaseBase) throw new Error("Supabase URL is not configured.");

    const base = supabaseBase.endsWith("/")
      ? supabaseBase.slice(0, -1)
      : supabaseBase;

    const functionUrl =
      base +
      "/functions/v1/transport-membership-status?customerRef=" +
      encodeURIComponent(customerRef);

    let responseData: any = null;
    let lastError = "Membership service failed.";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(functionUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        const raw = await response.text();

        if (!response.ok) {
          lastError = "Membership service failed: " + response.status;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 250 * attempt));
          }
          continue;
        }

        responseData = raw ? JSON.parse(raw) : { membership: null };
        break;
      } catch (error: any) {
        lastError = error?.message || lastError;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 250 * attempt));
        }
      }
    }

    if (responseData === null) throw new Error(lastError);

    const membership = responseData?.membership ?? null;
    const owner =
      membership?.plan_code === "owner" &&
      membership?.status === "active";

    const active = Boolean(
      owner ||
      (
        membership?.status === "active" &&
        membership?.expires_at &&
        new Date(String(membership.expires_at)).getTime() > Date.now()
      )
    );

    return NextResponse.json({
      active,
      owner,
      authorized: owner,
      membership,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || "Membership status unavailable.",
    }, { status: 503 });
  }
}
