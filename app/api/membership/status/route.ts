import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "../../../../lib/payments/supabase";

export async function GET(request: NextRequest) {
  const customerRef = request.nextUrl.searchParams.get("customerRef") || "";
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(customerRef)) {
    return NextResponse.json({ error:"Invalid customer reference." }, { status:400 });
  }
  try {
    const rows = await supabaseRest<Array<Record<string,unknown>>>(
      "transport_memberships?select=plan_code,status,starts_at,expires_at,amount,currency&customer_ref=eq." +
      encodeURIComponent(customerRef) + "&limit=1"
    );
    const membership = rows?.[0] || null;
    const active = Boolean(
      membership?.status === "active" &&
      membership?.expires_at &&
      new Date(String(membership.expires_at)).getTime() > Date.now()
    );
    return NextResponse.json({ active, membership });
  } catch (error:any) {
    return NextResponse.json({ error:error?.message || "Membership status unavailable." }, { status:503 });
  }
}
