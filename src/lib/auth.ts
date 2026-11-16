import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "rafa_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // stay signed in for 30 days

function secret(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

function sign(expires: number, key: string) {
  return createHmac("sha256", key).update(`admin.${expires}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function adminConfigured() {
  return Boolean(secret());
}

export function passwordMatches(input: string) {
  const key = secret();
  return Boolean(key) && safeEqual(input, key!);
}

export async function startSession() {
  const key = secret();
  if (!key) return;
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  (await cookies()).set(COOKIE, `${expires}.${sign(expires, key)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const key = secret();
  if (!key) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  const expires = Number(exp);
  if (!expires || expires < Date.now() / 1000 || !sig) return false;
  return safeEqual(sig, sign(expires, key));
}
