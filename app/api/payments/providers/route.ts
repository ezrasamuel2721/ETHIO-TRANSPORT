import { NextResponse } from "next/server";
import { supabasePublicRest } from "@/lib/payments/supabase";

export async function GET() {
  try {
    const rows = await supabasePublicRest<Array<Record<string,unknown>>>(
      "payment_providers?select=code,name,checkout_mode,capabilities,display_order&active=eq.true&order=display_order.asc"
    );
    return NextResponse.json({ providers: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Payment providers unavailable." }, { status: 503 });
  }
}
