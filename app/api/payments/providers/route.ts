import { NextResponse } from "next/server";
import { supabasePublicRest } from "../../../../lib/payments/supabase";

export async function GET() {
  try {
    const rows = await supabasePublicRest<Array<Record<string,unknown>>>(
      "payment_providers?select=code,name,checkout_mode,capabilities,display_order&active=eq.true&order=display_order.asc"
    );
    const telebirrConfigured = Boolean(
      process.env.TELEBIRR_BASE_URL &&
      process.env.TELEBIRR_APP_ID &&
      process.env.TELEBIRR_APP_SECRET &&
      process.env.TELEBIRR_MERCHANT_CODE &&
      process.env.TELEBIRR_FABRIC_APP_ID &&
      process.env.TELEBIRR_PRIVATE_KEY &&
      process.env.TELEBIRR_PUBLIC_KEY &&
      process.env.TELEBIRR_NOTIFY_URL &&
      process.env.TELEBIRR_REDIRECT_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    return NextResponse.json({
      providers: (rows || []).map(p => ({
        ...p,
        configured: p.code === "telebirr" ? telebirrConfigured : false
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Payment providers unavailable." }, { status: 503 });
  }
}
