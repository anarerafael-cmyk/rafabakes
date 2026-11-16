import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb, getStripe } from "@/lib/server";

// Stripe calls this when a card payment finishes, so orders get marked paid on their own.
export async function POST(req: Request) {
  const stripe = getStripe();
  const db = getDb();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !db || !secret) return new NextResponse("Not configured", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return new NextResponse("Bad signature", { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id;

  if (orderId && event.type === "checkout.session.completed" && session.payment_status === "paid") {
    await db.from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "pending");
  }

  // Abandoned card checkout: free the loaves back up for other customers.
  if (orderId && event.type === "checkout.session.expired") {
    await db.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
  }

  return NextResponse.json({ received: true });
}
