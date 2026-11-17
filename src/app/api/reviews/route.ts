import { NextResponse } from "next/server";
import { getDb } from "@/lib/server";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  let b: { code?: string; phoneLast4?: string; name?: string; rating?: number; body?: string };
  try {
    b = await req.json();
  } catch {
    return fail("Something went wrong. Please try again.");
  }

  const code = String(b.code ?? "").trim().toUpperCase();
  const last4 = String(b.phoneLast4 ?? "").replace(/\D/g, "");
  const name = String(b.name ?? "").trim().slice(0, 40);
  const body = String(b.body ?? "").trim().slice(0, 600);
  const rating = Math.round(Number(b.rating));

  if (!name) return fail("Please add your first name.");
  if (!body) return fail("Please say a little about your order.");
  if (!(rating >= 1 && rating <= 5)) return fail("Please pick a star rating.");
  if (!/^RAFA-\d{1,8}$/.test(code) || last4.length !== 4) {
    return fail("Add your order code (like RAFA-1042) and the last 4 digits of the phone number you ordered with.");
  }

  const db = getDb();
  if (!db) return fail("Reviews aren't switched on yet.", 503);

  // Slow down guessing at order codes.
  await new Promise((r) => setTimeout(r, 400));

  const { data: order } = await db
    .from("orders")
    .select("id, customer_phone, status")
    .eq("code", code)
    .maybeSingle();

  if (!order || order.status === "cancelled" || !String(order.customer_phone).replace(/\D/g, "").endsWith(last4)) {
    return fail("We couldn't match that order code and phone number. Check your confirmation page.", 404);
  }

  const { error } = await db.from("reviews").insert({ order_id: order.id, name, rating, body });
  if (error) {
    if (error.code === "23505") return fail("Thanks! There's already a review for this order.", 409);
    console.error("review insert failed", error);
    return fail("We couldn't save your review. Please try again.", 500);
  }

  return NextResponse.json({ ok: true });
}
