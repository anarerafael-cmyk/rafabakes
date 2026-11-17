import "server-only";
import { getDb } from "./server";

export async function getPublicReviews() {
  const db = getDb();
  if (!db) return { reviews: [], average: null as number | null, total: 0 };
  const { data } = await db
    .from("reviews")
    .select("id, name, rating, body")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  const all = data ?? [];
  const average = all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : null;
  return { reviews: all.slice(0, 6), average, total: all.length };
}
