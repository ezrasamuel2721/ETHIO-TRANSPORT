import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "../../../../../lib/payments/supabase";
import { verifyTelebirrNotification } from "../../../../../lib/payments/telebirr";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const orderId = String(payload?.merch_order_id || payload?.biz_content?.merch_order_id || "").trim();
    const providerTransactionId = String(payload?.orderId || payload?.transaction_id || payload?.biz_content?.prepay_id || "").trim();
    const resultCode = String(payload?.resultCode || payload?.result_code || payload?.code || payload?.biz_content?.resultCode || payload?.biz_content?.trade_status || "").toUpperCase();
    const success = ["SUCCESS","0","000000","200","TRADE_SUCCESS"].includes(resultCode);
    const failure = ["FAIL","FAILED","CANCEL","CANCELLED","ERROR","TRADE_FAILED"].includes(resultCode);

    if (!orderId) return NextResponse.json({ ok:false, error:"Missing merchant order id." }, { status:400 });

    const rows = await supabaseRest<Array<Record<string,unknown>>>(
      "payment_transactions?select=id,amount,status,provider_code,purpose,customer_ref,metadata&metadata->>order_id=eq." + encodeURIComponent(orderId) + "&limit=1"
    );
    const tx = rows?.[0];
    if (!tx?.id) return NextResponse.json({ ok:false, error:"Unknown order." }, { status:404 });

    if (!verifyTelebirrNotification(payload)) {
      await supabaseRest("payment_transactions?id=eq." + tx.id, {
        method:"PATCH", headers:{Prefer:"return=minimal"},
        body:JSON.stringify({ metadata:{...(tx.metadata as object || {}), callback_rejected:"invalid_signature"} })
      });
      return NextResponse.json({ ok:false, error:"Invalid provider notification signature." }, { status:401 });
    }

    if (failure) {
      await supabaseRest("payment_transactions?id=eq." + tx.id, {
        method:"PATCH", headers:{Prefer:"return=minimal"},
        body:JSON.stringify({ status:"failed", provider_transaction_id:providerTransactionId || null, metadata:{...(tx.metadata as object || {}), provider_callback:payload} })
      });
      return NextResponse.json({ ok:true, status:"failed" });
    }

    if (!success) {
      return NextResponse.json({ ok:true, status:"processing" });
    }

    const finalized = await supabaseRest(
      "rpc/finalize_ethio_payment",
      {
        method:"POST",
        headers:{Prefer:"return=representation"},
        body:JSON.stringify({
          p_transaction_id: tx.id,
          p_provider_transaction_id: providerTransactionId || null,
          p_paid_at: new Date().toISOString()
        })
      }
    );

    await supabaseRest("payment_transactions?id=eq." + tx.id, {
      method:"PATCH", headers:{Prefer:"return=minimal"},
      body:JSON.stringify({ metadata:{...(tx.metadata as object || {}), provider_callback:payload, finalized:true} })
    });

    return NextResponse.json({ok:true,status:"paid",result:finalized});
  } catch(error:any) {
    return NextResponse.json({ok:false,error:error?.message || "Callback processing failed."},{status:503});
  }
}
