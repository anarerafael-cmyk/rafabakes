import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/server";
import { money } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  if (!/^RAFA-\d{1,8}$/.test(code)) notFound();

  const db = getDb();
  if (!db) notFound();

  const { data: order } = await db
    .from("orders")
    .select("id, code, customer_name, pickup_slot, payment_method, status, total_cents, drops(pickup_location, closes_at), order_items(product_name, quantity)")
    .eq("code", code)
    .maybeSingle();
  if (!order) notFound();

  const drop = order.drops as unknown as { pickup_location: string; closes_at: string } | null;
  const items = order.order_items as { product_name: string; quantity: number }[];
  const firstName = order.customer_name.split(" ")[0];
  const venmo = process.env.NEXT_PUBLIC_VENMO_HANDLE || "";
  const zelle = process.env.NEXT_PUBLIC_ZELLE_CONTACT || "";
  const amount = (order.total_cents / 100).toFixed(2);
  // Card payment can land a moment after the redirect; treat ?paid=1 as paid-in-progress.
  const paid = order.status === "paid" || (order.payment_method === "card" && sp.paid === "1");
  const closes = drop ? new Date(drop.closes_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" }) : "";

  return (
    <main className="page">
      <header className="topbar">
        <Link href="/"><img className="logo" style={{ width: 108 }} src="/logo.png" alt="rafa sourdough & cookies, back to shop" /></Link>
      </header>

      <section className="panel" style={{ background: "var(--pink)" }}>
        <h1 style={{ fontSize: 36, lineHeight: 1, fontWeight: 700 }}>
          {order.status === "cancelled" ? "order cancelled" : `you're on the list, ${firstName}!`}
        </h1>
        <p style={{ margin: "12px 0 0", fontSize: 14 }}>
          Order <b>{order.code}</b> · {items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}
        </p>
      </section>

      {order.status !== "cancelled" && (
        <section className="card summary" style={{ gap: 12 }}>
          {paid ? (
            <>
              <span className="status paid">paid · thank you!</span>
              <span className="display" style={{ fontSize: 20, fontWeight: 600 }}>{money(order.total_cents)} received</span>
            </>
          ) : order.payment_method === "card" ? (
            <>
              <span className="status">payment not finished</span>
              <p style={{ margin: 0, fontSize: 14 }}>Your card checkout was closed before paying. Place the order again from the shop when you&apos;re ready.</p>
              <Link className="cta ghost" href="/">Back to shop</Link>
            </>
          ) : (
            <>
              <span className="status">waiting for your {order.payment_method === "venmo" ? "Venmo" : "Zelle"}</span>
              <span className="display" style={{ fontSize: 20, fontWeight: 600 }}>send {money(order.total_cents)} to finish</span>
              <div className="kv">
                <div><small>to</small><b>{order.payment_method === "venmo" ? `@${venmo}` : zelle}</b></div>
                <div><small>{order.payment_method === "venmo" ? "note" : "memo"}</small><b>{order.code}</b></div>
              </div>
              {order.payment_method === "venmo" && venmo && (
                <a className="cta" style={{ fontSize: 16, minHeight: 52 }}
                   href={`https://venmo.com/${encodeURIComponent(venmo)}?txn=pay&amount=${amount}&note=${encodeURIComponent(order.code)}`}>
                  Open Venmo
                </a>
              )}
              <p className="allergens">Not paid by {closes}? Your spot goes back to the drop.</p>
            </>
          )}
        </section>
      )}

      <section className="card summary" style={{ border: "none", gap: 12 }}>
        <span className="display" style={{ fontSize: 20, fontWeight: 600 }}>pickup</span>
        <p style={{ margin: 0, fontSize: 14 }}><b>{order.pickup_slot}</b><br />We&apos;ll text you a reminder the night before.</p>
        {drop?.pickup_location && <p style={{ margin: 0, fontSize: 14 }}><b>{drop.pickup_location}</b></p>}
      </section>

      {order.status !== "cancelled" && (
        <Link className="cta ghost" href={`/?review=${order.code}#reviews`}>Leave a review after pickup</Link>
      )}

      <p className="fineprint">Save this page. It&apos;s your receipt.</p>
    </main>
  );
}
