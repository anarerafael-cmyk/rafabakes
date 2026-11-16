import { NextResponse } from "next/server";
import { getDb, getStripe, siteUrl } from "@/lib/server";
import type { PaymentMethod } from "@/lib/types";

type Body = {
  dropId: string;
  name: string;
  phone: string;
  slot: string;
  method: PaymentMethod;
  wantsTexts: boolean;
  items: { dropItemId: string; quantity: number }[];
};

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: Request) {
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return fail("Something went wrong. Please try again.");
  }

  const name = String(b.name ?? "").trim().slice(0, 80);
  const phone = String(b.phone ?? "").replace(/[^\d+]/g, "").slice(0, 20);
  if (!name) return fail("Please add your name.");
  if (phone.replace(/\D/g, "").length < 10) return fail("Please add a phone number so we can text your pickup reminder.");
  if (!["card", "venmo", "zelle"].includes(b.method)) return fail("Please pick how you'd like to pay.");
  const items = (b.items ?? []).filter((i) => i.quantity > 0).slice(0, 20);
  if (!items.length) return fail("Your order is empty.");

  const db = getDb();
  if (!db) return fail("Ordering isn't switched on yet (this is a preview).", 503);

  const { data, error } = await db.rpc("place_order", {
    p_drop_id: b.dropId,
    p_name: name,
    p_phone: phone,
    p_slot: String(b.slot ?? "").slice(0, 60),
    p_method: b.method,
    p_wants_texts: Boolean(b.wantsTexts),
    p_items: items.map((i) => ({ drop_item_id: i.dropItemId, quantity: Math.floor(i.quantity) })),
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("SOLD_OUT:")) {
      const item = msg.split("SOLD_OUT:")[1]?.trim();
      return fail(`Sorry, there aren't enough ${item || "of one item"} left. Lower the amount and try again.`, 409);
    }
    if (msg.includes("DROP_CLOSED")) return fail("Orders for this drop are closed.", 409);
    console.error("place_order failed", error);
    return fail("We couldn't place that order. Please try again.", 500);
  }

  const order = (data as { order_id: string; order_code: string; total_cents: number }[])[0];

  if (b.method !== "card") {
    return NextResponse.json({ redirect: `/order/${order.order_code}` });
  }

  const stripe = getStripe();
  if (!stripe) return fail("Card payments aren't switched on yet.", 503);

  const { data: lines } = await db
    .from("order_items")
    .select("product_name, quantity, unit_price_cents")
    .eq("order_id", order.order_id);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: (lines ?? []).map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: "usd",
        unit_amount: l.unit_price_cents,
        product_data: { name: l.product_name },
      },
    })),
    client_reference_id: order.order_id,
    metadata: { order_id: order.order_id, order_code: order.order_code },
    success_url: `${siteUrl()}/order/${order.order_code}?paid=1`,
    cancel_url: `${siteUrl()}/order/${order.order_code}?cancelled=1`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // checkout link good for 1 hour
  });

  await db.from("orders").update({ stripe_session_id: session.id }).eq("id", order.order_id);
  return NextResponse.json({ redirect: session.url });
}
