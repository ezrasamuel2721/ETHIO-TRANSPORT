import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "@/lib/payments/supabase";

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
    return NextResponse.json({ transaction: rows?.[0] || null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Payment status unavailable." }, { status: 503 });
  }
}
