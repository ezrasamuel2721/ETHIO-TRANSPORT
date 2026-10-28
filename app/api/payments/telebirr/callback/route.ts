import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "../../../../lib/payments/supabase";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const orderId = String(payload?.merch_order_id || payload?.biz_content?.merch_order_id || "").trim();
    const providerTransactionId = String(payload?.orderId || payload?.transaction_id || payload?.biz_content?.prepay_id || "").trim();
    const resultCode = String(payload?.resultCode || payload?.result_code || payload?.code || payload?.biz_content?.resultCode || "").toUpperCase();
    const success = ["SUCCESS","0","000000","200"].includes(resultCode);
    const failure = ["FAIL","FAILED","CANCEL","CANCELLED","ERROR"].includes(resultCode);
    if (!orderId) return NextResponse.json({ ok:false, error:"Missing merchant order id." }, { status:400 });

    const rows = await supabaseRest<Array<{id:string}>>(
      "payment_transactions?select=id&metadata->>order_id=eq." + encodeURIComponent(orderId) + "&limit=1"
    );
    const id = rows?.[0]?.id;
    if (!id) return NextResponse.json({ ok:false, error:"Unknown order." }, { status:404 });

    await supabaseRest("payment_transactions?id=eq." + id, {
      method:"PATCH", headers:{Prefer:"return=minimal"},
      body:JSON.stringify({
        provider_transaction_id:providerTransactionId || null,
        status:success ? "processing" : failure ? "failed" : "processing",
        metadata:{provider_callback:payload}
      })
    });
    return NextResponse.json({ok:true});
  } catch(error:any) {
    return NextResponse.json({ok:false,error:error?.message || "Callback processing failed."},{status:503});
  }
}
