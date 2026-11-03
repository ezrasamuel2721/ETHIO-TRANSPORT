import crypto from "node:crypto";

export type ReviewUser = {
  username: string;
  institution: string;
  role?: string;
  passwordHash: string;
  expiresAt?: string;
};

type ReviewSession = { username: string; institution: string; role: string; exp: number };

function secret() {
  const value = process.env.REVIEW_ACCESS_SECRET;
  if (!value || value.length < 32) throw new Error("REVIEW_ACCESS_SECRET is not configured or is too short.");
  return value;
}
function users(): ReviewUser[] {
  const raw = process.env.REVIEW_USERS_JSON;
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function sign(payload: string) { return crypto.createHmac("sha256", secret()).update(payload).digest("base64url"); }

export function createReviewSession(user: ReviewUser) {
  const session: ReviewSession = { username:user.username, institution:user.institution, role:user.role || "institution_reviewer", exp:Date.now()+1000*60*60*8 };
  const payload=Buffer.from(JSON.stringify(session)).toString("base64url");
  return payload+"."+sign(payload);
}
export function verifyReviewSession(token: string|undefined): ReviewSession|null {
  if (!token) return null;
  const [payload,signature]=token.split(".");
  if (!payload||!signature) return null;
  const expected=sign(payload), a=Buffer.from(signature), b=Buffer.from(expected);
  if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
  try { const session=JSON.parse(Buffer.from(payload,"base64url").toString()) as ReviewSession; return session.exp>Date.now()?session:null; } catch { return null; }
}
export function authenticateReviewUser(username:string,password:string) {
  const user=users().find(item=>item.username===username);
  if (!user || (user.expiresAt && new Date(user.expiresAt).getTime()<=Date.now())) return null;
  const hash=crypto.createHash("sha256").update(password).digest("hex");
  if (hash.length!==user.passwordHash.length || !crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(user.passwordHash))) return null;
  return user;
}
export function reviewSetupReady() { return Boolean(process.env.REVIEW_ACCESS_SECRET && process.env.REVIEW_USERS_JSON); }
