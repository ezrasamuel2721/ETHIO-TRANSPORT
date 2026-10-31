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
    const membership = await supabasePublicRest<Record<string,unknown> | null>(
      "rpc/check_transport_membership",
      {
        method: "POST",
        body: JSON.stringify({ p_customer_ref: customerRef }),
      }
    );
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
