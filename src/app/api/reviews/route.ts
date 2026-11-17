import { NextResponse } from "next/server";
import { getDb } from "@/lib/server";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  let b: { name?: string; rating?: number; body?: string; order?: string; website?: string };
  try {
    b = await req.json();
  } catch {
    return fail("Something went wrong. Please try again.");
  }

  // Bots fill in the hidden "website" field; pretend it worked and drop it.
  if (b.website) return NextResponse.json({ ok: true });

  const name = String(b.name ?? "").trim().slice(0, 40);
  const body = String(b.body ?? "").trim().slice(0, 600);
  const rating = Math.round(Number(b.rating));
  if (!name) return fail("Please add your first name.");
  if (!body) return fail("Please say a little about your order.");
  if (!(rating >= 1 && rating <= 5)) return fail("Please pick a star rating.");

  const db = getDb();
  if (!db) return fail("Reviews aren't switched on yet.", 503);

  // A review that comes from an order page is linked to that order ("verified order").
  let orderId: string | null = null;
  const token = String(b.order ?? "");
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const { data: order } = await db.from("orders").select("id, status").eq("id", token).maybeSingle();
    if (order && order.status !== "cancelled") orderId = order.id;
  }

  const { error } = await db.from("reviews").insert({ order_id: orderId, name, rating, body });
  if (error) {
    // Already reviewed this order: save it unlinked rather than turning them away.
    if (error.code === "23505") {
      await db.from("reviews").insert({ order_id: null, name, rating, body });
      return NextResponse.json({ ok: true });
    }
    console.error("review insert failed", error);
    return fail("We couldn't save your review. Please try again.", 500);
  }
  return NextResponse.json({ ok: true });
}
