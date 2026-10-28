const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function requirePaymentDb() {
  if (!base || !key) throw new Error("Payment database is not configured.");
  return { base: base.replace(/\/$/, ""), key };
}

export async function supabasePublicRest<T = unknown>(path: string) {
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !publicKey) throw new Error("Supabase public API is not configured.");
  const response = await fetch(base.replace(/\/$/, "") + "/rest/v1/" + path, {
    headers: { apikey: publicKey, Authorization: "Bearer " + publicKey },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || ("Supabase request failed: " + response.status));
  return text ? (JSON.parse(text) as T) : (undefined as T);
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
