const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function requirePaymentDb() {
  if (!base || !key) throw new Error("Payment database is not configured.");
  return { base: base.replace(/\\/$/, ""), key };
}

export async function supabaseRest<T = unknown>(path: string, init: RequestInit = {}) {
  const db = requirePaymentDb();
  const response = await fetch(db.base + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: db.key,
      Authorization: "Bearer " + db.key,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || ("Supabase request failed: " + response.status));
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
