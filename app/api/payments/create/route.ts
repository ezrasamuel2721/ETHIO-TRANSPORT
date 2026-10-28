import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseRest } from "../../../../lib/payments/supabase";
import { createTelebirrOrder } from "../../../../lib/payments/telebirr";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const purpose = body?.purpose === "bus_ticket" ? "bus_ticket" : "membership";
    // Never accept a client-entered amount for a ticket. Ticket checkout must
    // be backed by a confirmed operator order and server-verified ticket price.
    if (purpose === "bus_ticket") {
      return NextResponse.json({
        error: "Bus-ticket payments are not enabled until a confirmed operator order and server-verified ticket price are connected."
      }, { status: 409 });
    }
    const provider = String(body?.provider || "").trim();
    const customerRef = String(body?.customerRef || "").trim();
    const amount = Number(body?.amount);

    if (!customerRef || !/^[A-Za-z0-9_-]{16,80}$/.test(customerRef)) {
      return NextResponse.json({ error: "Invalid customer reference." }, { status: 400 });
    }
    if (!["telebirr","bank_gateway","card"].includes(provider)) {
      return NextResponse.json({ error: "Unsupported payment provider." }, { status: 400 });
    }
    // The UI disables providers without checkout integration, but the server must
    // enforce the same rule. Never create a pending transaction for a gateway
    // that cannot take payment and return a verified callback.
    if (provider !== "telebirr") {
      return NextResponse.json({
        error: "This payment provider does not yet have a live checkout integration."
      }, { status: 503 });
    }
    if (provider === "telebirr" && !(
      process.env.TELEBIRR_BASE_URL &&
      process.env.TELEBIRR_APP_ID &&
      process.env.TELEBIRR_APP_SECRET &&
      process.env.TELEBIRR_MERCHANT_CODE &&
      process.env.TELEBIRR_FABRIC_APP_ID &&
      process.env.TELEBIRR_PRIVATE_KEY &&
      process.env.TELEBIRR_PUBLIC_KEY &&
      process.env.TELEBIRR_NOTIFY_URL &&
      process.env.TELEBIRR_REDIRECT_URL
    )) {
      return NextResponse.json({ error: "Telebirr production credentials are not configured yet." }, { status: 503 });
    }

    const membershipPrice = Number(process.env.ETHIO_TRANSPORT_MEMBERSHIP_PRICE_ETB || "250");
    const finalAmount = purpose === "membership" ? membershipPrice : amount;
    if (!Number.isFinite(finalAmount) || finalAmount <= 0 || finalAmount > 1000000) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }

    if (purpose === "membership" && (!Number.isFinite(membershipPrice) || membershipPrice <= 0)) {
      return NextResponse.json({ error: "Membership pricing is not configured." }, { status: 503 });
    }

    const existing = await supabaseRest<Array<Record<string,unknown>>>(
      "payment_transactions?select=id,status,amount,metadata&customer_ref=eq." + encodeURIComponent(customerRef) +
      "&purpose=eq." + purpose + "&status=in.(pending,processing)&expires_at=gt." + encodeURIComponent(new Date().toISOString()) +
      "&order=created_at.desc&limit=1"
    );
    if (existing?.[0]?.id) {
      return NextResponse.json({
        transactionId: existing[0].id,
        provider,
        status: existing[0].status,
        message: "An active payment transaction already exists for this customer."
      });
    }

    const orderId = ("ET" + Date.now() + crypto.randomBytes(4).toString("hex")).slice(0,32);
    const created = await supabaseRest<Array<{id:string}>>("payment_transactions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        customer_ref: customerRef, purpose, amount: finalAmount, currency: "ETB",
        provider_code: provider, status: "pending",
        metadata: { order_id: orderId },
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      }),
    });
    const transactionId = created?.[0]?.id;
    if (!transactionId) throw new Error("Could not create payment transaction.");

    if (provider === "telebirr") {
      try {
        const result = await createTelebirrOrder({
          orderId,
          title: purpose === "membership" ? "ETHIO TRANSPORT Annual Service" : "ETHIO TRANSPORT Bus Ticket",
          amount: finalAmount.toFixed(2),
        });
        await supabaseRest("payment_transactions?id=eq." + transactionId, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            provider_transaction_id: result.providerTransactionId,
            status: "processing",
            metadata: { order_id: orderId, prepay_id: result.prepayId, raw_request_present: Boolean(result.rawRequest || result.receiveCode) },
          }),
        });
        return NextResponse.json({
          transactionId, provider, status: "processing",
          rawRequest: result.rawRequest, receiveCode: result.receiveCode, prepayId: result.prepayId
        });
      } catch (providerError: any) {
        await supabaseRest("payment_transactions?id=eq." + transactionId, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed", metadata: { order_id: orderId, setup_error: providerError?.message || "provider error" } }),
        });
        throw providerError;
      }
    }

    return NextResponse.json({
      transactionId, provider, status: "pending_provider_setup",
      message: "This provider is registered in the payment engine but its production credentials are not configured yet."
    }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Payment could not be started." }, { status: 503 });
  }
}
