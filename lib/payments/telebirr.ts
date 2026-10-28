import crypto from "node:crypto";

type TelebirrConfig = {
  baseUrl: string; appId: string; appSecret: string; merchantCode: string;
  fabricAppId: string; privateKey: string; notifyUrl: string; redirectUrl: string;
};

function getConfig(): TelebirrConfig {
  const values = {
    baseUrl: process.env.TELEBIRR_BASE_URL,
    appId: process.env.TELEBIRR_APP_ID,
    appSecret: process.env.TELEBIRR_APP_SECRET,
    merchantCode: process.env.TELEBIRR_MERCHANT_CODE,
    fabricAppId: process.env.TELEBIRR_FABRIC_APP_ID,
    privateKey: process.env.TELEBIRR_PRIVATE_KEY,
    notifyUrl: process.env.TELEBIRR_NOTIFY_URL,
    redirectUrl: process.env.TELEBIRR_REDIRECT_URL,
  } as Record<string, string | undefined>;
  const required = ["baseUrl","appId","appSecret","merchantCode","fabricAppId","privateKey","notifyUrl","redirectUrl"];
  const missing = required.filter(k => !values[k]);
  if (missing.length) throw new Error("Telebirr production credentials are not configured: " + missing.join(", "));
  return values as TelebirrConfig;
}

function nonce() { return crypto.randomBytes(16).toString("hex").toUpperCase(); }
function timestamp() { return Math.floor(Date.now() / 1000).toString(); }

function signRequest(body: Record<string, unknown>, privateKey: string) {
  const excluded = new Set(["sign","sign_type","header","refund_info","openType","raw_request","wallet_reference_data"]);
  const fields: Array<[string,string]> = [];
  for (const [key,value] of Object.entries(body)) {
    if (excluded.has(key) || value === undefined || value === null) continue;
    if (key === "biz_content" && value && typeof value === "object") {
      for (const [k,v] of Object.entries(value as Record<string,unknown>)) {
        if (!excluded.has(k) && v !== undefined && v !== null) fields.push([k,String(v)]);
      }
    } else fields.push([key,String(value)]);
  }
  fields.sort((a,b) => a[0].localeCompare(b[0]));
  const origin = fields.map(([k,v]) => k + "=" + v).join("&");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(origin);
  signer.end();
  return signer.sign(privateKey, "base64");
}

export function verifyTelebirrNotification(body: Record<string, unknown>) {
  const publicKey = process.env.TELEBIRR_PUBLIC_KEY;
  const signature = String(body?.sign || "").trim();
  if (!publicKey || !signature) return false;
  const origin = canonicalFields(body).map(([k,v]) => k + "=" + v).join("&");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(origin);
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

async function postJson(url: string, body: unknown, headers: Record<string,string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data?.errorMsg || data?.message || ("Telebirr HTTP " + response.status));
  return data;
}

async function getFabricToken(c: TelebirrConfig) {
  const result = await postJson(
    c.baseUrl.replace(/\/$/,"") + "/payment/v1/token",
    { appId: c.appId, appSecret: c.appSecret },
    { "X-APP-Key": c.fabricAppId }
  );
  const token = result?.data?.access_token || result?.access_token || result?.token;
  if (!token) throw new Error("Telebirr token was not returned by the payment service.");
  return String(token);
}

export async function createTelebirrOrder(input: { orderId:string; title:string; amount:string }) {
  const c = getConfig();
  const unsigned = {
    timestamp: timestamp(),
    nonce_str: nonce(),
    method: "payment.preorder",
    version: "1.0",
    biz_content: {
      notify_url: c.notifyUrl,
      redirect_url: c.redirectUrl,
      appid: c.appId,
      merch_code: c.merchantCode,
      merch_order_id: input.orderId,
      trade_type: "Checkout",
      title: input.title,
      total_amount: input.amount,
      trans_currency: "ETB",
      timeout_express: "120m",
      business_type: "BuyGoods",
    },
  };
  const payload = { ...unsigned, sign: signRequest(unsigned, c.privateKey), sign_type: "SHA256WithRSA" };
  const result = await postJson(
    c.baseUrl.replace(/\/$/,"") + "/payment/v1/merchant/preOrder",
    payload,
    { "X-APP-Key": c.fabricAppId, Authorization: "Bearer " + await getFabricToken(c) }
  );
  const biz = result?.biz_content || result?.data || {};
  return {
    rawRequest: result?.raw_request || result?.rawRequest || null,
    receiveCode: result?.receiveCode || result?.receive_code || null,
    prepayId: biz?.prepay_id || result?.prepay_id || null,
    providerTransactionId: result?.orderId || result?.transaction_id || biz?.prepay_id || null,
  };
}
