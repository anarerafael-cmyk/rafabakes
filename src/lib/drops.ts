import "server-only";
import { getDb } from "./server";
import type { Drop } from "./types";

/** Sample drop shown only when the database isn't connected yet (local preview). */
const SAMPLE: Drop = {
  id: "sample",
  title: "this week's drop",
  opensAt: new Date(Date.now() - 864e5).toISOString(),
  closesAt: new Date(Date.now() + 3 * 864e5).toISOString(),
  pickupLabel: "Sat, 9–11 AM",
  pickupLocation: "[YOUR PICKUP SPOT]",
  pickupSlots: ["Sat 9–10 AM", "Sat 10–11 AM"],
  items: [
    {
      dropItemId: "sample-plain",
      name: "plain sourdough",
      description: "Flour, water, salt, sourdough culture. Naturally fermented, no preservatives.",
      priceCents: 800,
      allergens: ["wheat"],
      imageUrl: "/plain-sourdough.jpg",
      badge: "small batch",
      left: 12,
    },
    {
      dropItemId: "sample-cookie",
      name: "chocolate chip walnut (6)",
      description: "Half dozen per box.",
      priceCents: 1200,
      allergens: ["wheat", "milk", "eggs", "walnuts"],
      imageUrl: null,
      badge: "new",
      left: 10,
    },
  ],
};

export type DropResult =
  | { state: "open"; drop: Drop; preview: boolean }
  | { state: "upcoming"; drop: Drop }
  | { state: "none" };

/** The drop that's open now, or else the next one coming up. */
export async function getCurrentDrop(): Promise<DropResult> {
  const db = getDb();
  if (!db) return { state: "open", drop: SAMPLE, preview: true };

  const now = new Date().toISOString();
  const { data: drops, error } = await db
    .from("drops")
    .select("*")
    .gte("closes_at", now)
    .order("opens_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const d = drops?.[0];
  if (!d) return { state: "none" };

  const { data: rows, error: e2 } = await db
    .from("drop_items")
    .select("id, cap, sort, products(name, description, price_cents, allergens, image_url, badge)")
    .eq("drop_id", d.id)
    .order("sort");
  if (e2) throw e2;

  const ids = (rows ?? []).map((r) => r.id);
  const { data: stock } = await db
    .from("drop_item_stock")
    .select("drop_item_id, sold")
    .in("drop_item_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const sold = new Map((stock ?? []).map((s) => [s.drop_item_id, s.sold as number]));

  const drop: Drop = {
    id: d.id,
    title: d.title,
    opensAt: d.opens_at,
    closesAt: d.closes_at,
    pickupLabel: d.pickup_label,
    pickupLocation: d.pickup_location,
    pickupSlots: d.pickup_slots,
    items: (rows ?? []).map((r) => {
      // Supabase types a joined row loosely; it's a single product here.
      const p = r.products as unknown as {
        name: string; description: string; price_cents: number;
        allergens: string[]; image_url: string | null; badge: string | null;
      };
      return {
        dropItemId: r.id,
        name: p.name,
        description: p.description,
        priceCents: p.price_cents,
        allergens: p.allergens,
        imageUrl: p.image_url,
        badge: p.badge,
        left: Math.max(0, r.cap - (sold.get(r.id) ?? 0)),
      };
    }),
  };

  return new Date(d.opens_at) > new Date() ? { state: "upcoming", drop } : { state: "open", drop, preview: false };
}
