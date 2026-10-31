import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ethio_transport_authorized";

function hashCode(code: string) {
  return createHash("sha256").update(code.toLowerCase(), "utf8").digest("hex");
}

function tokenFor(customerRef: string, secret: string) {
  return createHmac("sha256", secret).update(customerRef, "utf8").digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerRef = typeof body?.customerRef === "string" ? body.customerRef : "";
    const accessCode = typeof body?.accessCode === "string" ? body.accessCode.trim() : "";
    const expectedHash = process.env.ETHIO_TRANSPORT_AUTHORIZED_ACCESS_CODE_HASH || "";

    if (!/^[A-Za-z0-9_-]{16,80}$/.test(customerRef) || !/^[a-fA-F0-9]{32,128}$/.test(accessCode)) {
      return NextResponse.json({ authorized: false, error: "Invalid access details." }, { status: 400 });
    }
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
      return NextResponse.json({ authorized: false, error: "Authorized access is not configured." }, { status: 503 });
    }

    const receivedHash = hashCode(accessCode);
    const ok = timingSafeEqual(Buffer.from(receivedHash, "hex"), Buffer.from(expectedHash, "hex"));
    if (!ok) {
      return NextResponse.json({ authorized: false, error: "Access verification failed." }, { status: 403 });
    }

    const response = NextResponse.json(
      { authorized: true },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set({
      name: COOKIE_NAME,
      value: tokenFor(customerRef, expectedHash),
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json({ authorized: false, error: "Access verification service is temporarily unavailable." }, { status: 503 });
  }
}
