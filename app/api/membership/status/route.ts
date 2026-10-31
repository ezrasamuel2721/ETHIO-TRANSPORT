import { NextRequest, NextResponse } from "next/server";
import { supabasePublicRest } from "../../../../lib/payments/supabase";

function isPrivilegedCustomerRef(customerRef: string) {
  const configured = [
    process.env.ETHIO_TRANSPORT_OWNER_CUSTOMER_REFS || "",
    process.env.ETHIO_TRANSPORT_AUTHORIZED_CUSTOMER_REFS || "",
  ].join(",");
  const refs = configured.split(",").map(value => value.trim()).filter(Boolean);
  return refs.includes(customerRef);
}

export async function GET(request: NextRequest) {
  const customerRef = request.nextUrl.searchParams.get("customerRef") || "";
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(customerRef)) {
    return NextResponse.json({ error:"Invalid customer reference." }, { status:400 });
  }

  if (isPrivilegedCustomerRef(customerRef)) {
    return NextResponse.json({
      active: true,
      owner: true,
      authorized: true,
      membership: {
        plan_code: "owner",
        status: "active",
        starts_at: null,
        expires_at: null,
        amount: 0,
        currency: "ETB",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    const base = process.env.SUPABASE_URL;
    if (!base || !publicKey) throw new Error("Supabase public API is not configured.");
    let membership: any = null;
    let lastError = "Membership RPC failed.";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rpcResponse = await fetch(
          base.replace(/\/$/, "") + "/rest/v1/rpc/check_transport_membership",
          {
            method: "POST",
            headers: {
              apikey: publicKey,
              Authorization: "Bearer " + publicKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ p_customer_ref: customerRef }),
            cache: "no-store",
          }
        );
        if (!rpcResponse.ok) {
          lastError = "Membership RPC failed: " + rpcResponse.status;
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
          continue;
        }
        membership = await rpcResponse.json();
        break;
      } catch (error: any) {
        lastError = error?.message || lastError;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
      }
    }
    if (membership === null) throw new Error(lastError);
    const active = Boolean(
      membership?.status === "active" &&
      membership?.expires_at &&
      new Date(String(membership.expires_at)).getTime() > Date.now()
    );
    return NextResponse.json({ active, owner: false,
    authorized: false,
    membership }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error:any) {
    return NextResponse.json({ error:error?.message || "Membership status unavailable." }, { status:503 });
  }
}
