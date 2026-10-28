import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "../../../../lib/payments/supabase";

export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get("transactionId") || "";
  const customerRef = request.nextUrl.searchParams.get("customerRef") || "";
  if (!/^[0-9a-f-]{36}$/i.test(transactionId) || !/^[A-Za-z0-9_-]{16,80}$/.test(customerRef)) {
    return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
  }
  try {
    const rows = await supabaseRest<Array<Record<string,unknown>>>(
      "payment_transactions?select=id,purpose,amount,currency,status,provider_code,paid_at,created_at&id=eq." +
      transactionId + "&customer_ref=eq." + encodeURIComponent(customerRef) + "&limit=1"
    );
    const membership = await supabaseRest<Array<Record<string,unknown>>>(
      "transport_memberships?select=plan_code,status,starts_at,expires_at,amount,currency&customer_ref=eq." +
      encodeURIComponent(customerRef) + "&limit=1"
    );
    return NextResponse.json({
      transaction: rows?.[0] || null,
      membership: membership?.[0] || null,
      membershipActive: Boolean(
        membership?.[0]?.status === "active" &&
        membership?.[0]?.expires_at &&
        new Date(String(membership[0].expires_at)).getTime() > Date.now()
      )
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Payment status unavailable." }, { status: 503 });
  }
}
