import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerRef = typeof body?.customerRef === "string" ? body.customerRef : "";
    const activationCode = typeof body?.activationCode === "string" ? body.activationCode.trim() : "";

    if (!/^[A-Za-z0-9_-]{16,80}$/.test(customerRef) || !/^[a-fA-F0-9]{32,128}$/.test(activationCode)) {
      return NextResponse.json({ claimed: false, error: "Invalid activation details." }, { status: 400 });
    }

    const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    const base = process.env.SUPABASE_URL;
    if (!base || !publicKey) {
      return NextResponse.json({ claimed: false, error: "Membership service is not configured." }, { status: 503 });
    }

    const activationCodeHash = createHash("sha256").update(activationCode.toLowerCase(), "utf8").digest("hex");
    const response = await fetch(
      base.replace(/\/$/, "") + "/rest/v1/rpc/claim_transport_owner",
      {
        method: "POST",
        headers: {
          apikey: publicKey,
          ...(publicKey.startsWith("sb_publishable_") ? {} : { Authorization: "Bearer " + publicKey }),
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          p_customer_ref: customerRef,
          p_activation_code_hash: activationCodeHash,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json({ claimed: false, error: "Owner activation could not be verified." }, { status: 503 });
    }

    const result = await response.json();
    if (!result?.claimed) {
      return NextResponse.json({ claimed: false, error: "The owner activation code is invalid or has already been used." }, { status: 403 });
    }

    return NextResponse.json(
      { claimed: true, alreadyClaimed: Boolean(result.already_claimed) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ claimed: false, error: "Owner activation service is temporarily unavailable." }, { status: 503 });
  }
}
