import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

let db: SupabaseClient | null = null;
let stripeClient: Stripe | null = null;

/** Server-only database client. Uses the secret key, never sent to browsers. */
export function getDb(): SupabaseClient | null {
  // Supabase's own Vercel integration names the URL NEXT_PUBLIC_SUPABASE_URL; accept either.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!db) db = createClient(url, key, { auth: { persistSession: false } });
  return db;
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
