import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ethio_transport_owner";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerRef = typeof body?.customerRef === "string" ? body.customerRef : "";
    const activationCode = typeof body?.activationCode === "string" ? body.activationCode.trim() : "";
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(customerRef) || !/^\d{4}$/.test(activationCode)) {
      return NextResponse.json({ claimed: false, error: "Invalid activation details." }, { status: 400 });
    }

    const expectedHash = process.env.ETHIO_TRANSPORT_OWNER_ACTIVATION_CODE_HASH || "";
    if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
      return NextResponse.json({ claimed: false, error: "Owner activation is not configured." }, { status: 503 });
    }

    const suppliedHash = createHash("sha256").update(activationCode, "utf8").digest();
    const expected = Buffer.from(expectedHash, "hex");
    if (suppliedHash.length !== expected.length || !timingSafeEqual(suppliedHash, expected)) {
      return NextResponse.json({ claimed: false, error: "Incorrect owner code." }, { status: 403 });
    }

    const token = createHmac("sha256", expected).update(customerRef, "utf8").digest("hex");
    const response = NextResponse.json(
      { claimed: true, owner: true },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json({ claimed: false, error: "Owner activation service is temporarily unavailable." }, { status: 503 });
  }
}
