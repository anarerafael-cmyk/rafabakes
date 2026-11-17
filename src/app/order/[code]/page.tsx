import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/server";
import { money } from "@/lib/types";
import { Ridge } from "../../ui";

export const dynamic = "force-dynamic";

type DropRow = { pickup_location: string; closes_at: string; pickup_date?: string | null };

// "plain sourdough" -> "loaves", "chocolate chip walnut (6)" -> "cookies"
function shortLabel(name: string, qty: number) {
  const n = name.toLowerCase();
  if (/sourdough|loaf|bread|boule|bagel/.test(n) && !/cookie/.test(n)) return qty === 1 ? "loaf" : "loaves";
  if (/cookie|chip|snickerdoodle/.test(n)) return "cookies";
  return n.replace(/\(.*\)/, "").trim().split(" ")[0];
}

function denverToday() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // YYYY-MM-DD
}

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
    .select("id, code, customer_name, pickup_slot, payment_method, status, total_cents, drops(*), order_items(product_name, quantity)")
    .eq("code", code)
    .maybeSingle();
  if (!order) notFound();

  const drop = order.drops as unknown as DropRow | null;
  const items = order.order_items as { product_name: string; quantity: number }[];
  const firstName = order.customer_name.split(" ")[0];
  const venmo = process.env.NEXT_PUBLIC_VENMO_HANDLE || "";
  const zelle = process.env.NEXT_PUBLIC_ZELLE_CONTACT || "";
  const amount = (order.total_cents / 100).toFixed(2);
  // Card payment can land a moment after the redirect; treat ?paid=1 as paid-in-progress.
  const paid = order.status === "paid" || (order.payment_method === "card" && sp.paid === "1");
  const closes = drop ? new Date(drop.closes_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" }) : "";
  const cancelled = order.status === "cancelled";

  // Pickup day for the calendar and countdown.
  let pickupDate = drop?.pickup_date ?? null;
  if (!pickupDate && drop) {
    const d = new Date(drop.closes_at);
    d.setUTCDate(d.getUTCDate() + 2);
    pickupDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
  const pd = pickupDate ? new Date(pickupDate + "T12:00:00Z") : null;
  const month = pd?.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) ?? "";
  const dayNum = pd?.getUTCDate() ?? "";
  const weekday = pd?.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" }) ?? "";
  const daysLeft = pd ? Math.round((pd.getTime() - new Date(denverToday() + "T12:00:00Z").getTime()) / 864e5) : null;
  const countBig = daysLeft === null || daysLeft < 0 ? "♥" : daysLeft === 0 ? "today" : daysLeft === 1 ? "tmrw" : String(daysLeft);
  const countSmall = daysLeft === null || daysLeft < 0 ? "enjoy!" : daysLeft <= 1 ? "is pickup!" : "days till\npickup!";
  const dots = items.slice(0, 2);
  const extra = items.length - dots.length;
  const label = `Thank you! Your order: ${items.map((i) => `${i.quantity} ${i.product_name}`).join(", ")}.${pd ? ` Pickup ${weekday}, ${month} ${dayNum}.` : ""}`;

  return (
    <main className="page" style={{ paddingBottom: 0 }}>
      <header className="topbar">
        <Link href="/"><img className="logo" style={{ width: 104 }} src="/logo.png" alt="rafa sourdough & cookies, back to shop" /></Link>
      </header>

      <section className="confirm-hero">
        {!cancelled && (
          <div className="morph" role="img" aria-label={label}>
            <div className="m m1 m-shadow" style={{ left: 11, top: 0, width: 90, height: 108 }}>
              <svg aria-hidden="true" width="90" height="108" viewBox="0 0 90 108" style={{ position: "absolute", inset: 0 }}>
                <path d="M4 4 H86 V96 L77.8,104 L69.6,96 L61.4,104 L53.2,96 L45,104 L36.8,96 L28.6,104 L20.4,96 L12.2,104 L4,96 Z" fill="#FFFFFF" stroke="#2A1A12" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M14 30 H76" stroke="#2A1A12" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, textAlign: "center" }}>
                <span className="m-small" style={{ color: "var(--muted)", letterSpacing: 0.6 }}>receipt</span>
                <b className="m-big" style={{ fontSize: 21, marginTop: 22, color: "var(--caramel)" }}>thank<br />you!</b>
              </div>
            </div>
            {dots.map((it, idx) => (
              <span key={idx} className={`m ${idx === 0 ? "m2" : "m2b"} m-round sticker`}
                style={idx === 0
                  ? { left: 0, top: 6, width: 66, height: 66, background: "var(--caramel)", color: "#fff" }
                  : { left: 46, top: 48, width: 60, height: 60, background: "var(--sky)" }}>
                <b className="m-big" style={{ fontSize: idx === 0 ? 22 : 20 }}>×{it.quantity}</b>
                <span className="m-small">{shortLabel(it.product_name, it.quantity)}{idx === 1 && extra > 0 ? ` +${extra}` : ""}</span>
              </span>
            ))}
            {pd && (
              <span className="m m3 sticker" style={{ left: 16, top: 10, width: 80, borderRadius: 16, background: "var(--paper)", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <span className="m-small" style={{ display: "block", width: "100%", background: "var(--caramel)", color: "#fff", fontSize: 10, padding: "4px 0", borderBottom: "2px solid var(--ink)" }}>pickup</span>
                <span className="m-small" style={{ fontSize: 11, color: "var(--caramel-dark)", paddingTop: 5 }}>{month}</span>
                <b className="m-big" style={{ fontSize: 30 }}>{dayNum}</b>
                <span className="m-small" style={{ fontSize: 10, paddingBottom: 6 }}>{weekday}</span>
              </span>
            )}
            <div className="m m4 m-shadow" style={{ left: 0, top: 0, width: 112, height: 112 }}>
              <svg aria-hidden="true" width="112" height="112" viewBox="0 0 112 112" style={{ position: "absolute", inset: 0 }}>
                <path d="M56.0,4.0 L64.6,12.8 L75.9,7.9 L80.4,19.4 L92.8,19.2 L92.6,31.6 L104.1,36.1 L99.2,47.4 L108.0,56.0 L99.2,64.6 L104.1,75.9 L92.6,80.4 L92.8,92.8 L80.4,92.6 L75.9,104.1 L64.6,99.2 L56.0,108.0 L47.4,99.2 L36.1,104.1 L31.6,92.6 L19.2,92.8 L19.4,80.4 L7.9,75.9 L12.8,64.6 L4.0,56.0 L12.8,47.4 L7.9,36.1 L19.4,31.6 L19.2,19.2 L31.6,19.4 L36.1,7.9 L47.4,12.8 Z" fill="#9DCBEA" stroke="#2A1A12" strokeWidth="2.5" strokeLinejoin="round" />
              </svg>
              <div style={{ position: "relative", height: 112, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <b className="m-big" style={{ fontSize: countBig.length > 2 ? 24 : 36 }}>{countBig}</b>
                <span className="m-small" style={{ fontSize: 10, whiteSpace: "pre-line" }}>{countSmall}</span>
              </div>
            </div>
          </div>
        )}
        <span className="chip" style={{ textTransform: "uppercase", letterSpacing: 0.4, fontSize: 11 }}>order {order.code}</span>
        <h1>{cancelled ? "order cancelled" : `you're on the list, ${firstName}!`}</h1>
        <p>{items.map((i) => `${i.quantity} × ${i.product_name}`).join(" · ")}</p>
      </section>

      {!cancelled && (
        <section className="card summary" style={{ gap: 12, padding: 18 }}>
          {paid ? (
            <>
              <span className="status paid">paid · thank you!</span>
              <span className="display" style={{ fontSize: 22 }}>{money(order.total_cents)} received</span>
            </>
          ) : order.payment_method === "card" ? (
            <>
              <span className="status">payment not finished</span>
              <p style={{ margin: 0, fontSize: 14 }}>Your card checkout was closed before paying. Place the order again from the shop when you&apos;re ready.</p>
              <Link className="cta ghost" href="/">Back to shop</Link>
            </>
          ) : (
            <>
              <span className="status"><span className="dot" />waiting for your {order.payment_method === "venmo" ? "Venmo" : "Zelle"}</span>
              <span className="display" style={{ fontSize: 22 }}>send {money(order.total_cents)} to finish</span>
              <div className="kv">
                <div><small>to</small><b>{order.payment_method === "venmo" ? `@${venmo}` : zelle}</b></div>
                <div><small>{order.payment_method === "venmo" ? "note" : "memo"}</small><b>{order.code}</b></div>
              </div>
              {order.payment_method === "venmo" && venmo && (
                <a className="cta" style={{ fontSize: 18, minHeight: 54 }}
                   href={`https://venmo.com/${encodeURIComponent(venmo)}?txn=pay&amount=${amount}&note=${encodeURIComponent(order.code)}`}>
                  Open Venmo
                </a>
              )}
              <p className="allergens">Not paid by {closes}? Your spot goes back to the drop.</p>
            </>
          )}
        </section>
      )}

      <section className="card summary" style={{ gap: 12, padding: 18 }}>
        <h2 style={{ fontSize: 24 }}>pickup</h2>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span className="icon-dot">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <b style={{ fontSize: 17 }}>{pd ? `${weekday}, ${month} ${dayNum} · ` : ""}{order.pickup_slot}</b>
            {drop?.pickup_location && <span style={{ fontSize: 14, fontWeight: 700 }}>{drop.pickup_location}</span>}
            <span style={{ fontSize: 13, color: "var(--body)" }}>We&apos;ll text a reminder the night before.</span>
          </div>
        </div>
      </section>

      {!cancelled && (
        <Link className="cta ghost" href={`/?review=${order.id}#reviews`}>
          <span style={{ color: "var(--caramel)" }}>★</span> Leave a review after pickup
        </Link>
      )}

      <div style={{ margin: "18px -14px 0" }}>
        <Ridge />
        <div className="dark" style={{ padding: "6px 20px 28px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="display" style={{ fontWeight: 600, fontSize: 17 }}>baked with love in colorado</span>
          <span style={{ fontSize: 12, color: "#e9d8c2" }}>Save this page. It&apos;s your receipt.</span>
        </div>
      </div>
    </main>
  );
}
