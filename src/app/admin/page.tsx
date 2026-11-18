import type { Metadata } from "next";
import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/server";
import { formatDropTime, money } from "@/lib/types";
import AdminHeader from "./Header";
import IngredientList, { type BakeNeeds } from "./IngredientList";
import LoginForm from "./LoginForm";
import { cancelOrder, closeDropNow, deleteEmptyDrop, markPaid, markUnpaid } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "baker view · rafa", robots: { index: false } };

type OrderRow = {
  id: string; code: string; customer_name: string; customer_phone: string; pickup_slot: string;
  payment_method: "card" | "venmo" | "zelle"; status: "pending" | "paid" | "cancelled";
  total_cents: number; created_at: string;
  order_items: { product_name: string; quantity: number; drop_item_id: string }[];
};

const METHOD = { card: "Card", venmo: "Venmo", zelle: "Zelle" } as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ drop?: string }> }) {
  if (!adminConfigured()) {
    return (
      <main className="page">
        <div className="error">Add an <b>ADMIN_PASSWORD</b> environment variable in Vercel, then redeploy, to switch on the baker view.</div>
      </main>
    );
  }
  if (!(await isAdmin())) {
    return (
      <main className="page" style={{ paddingTop: 48 }}>
        <img className="logo" src="/logo.png" alt="rafa sourdough & cookies" />
        <LoginForm />
      </main>
    );
  }

  const db = getDb();
  if (!db) return <main className="page"><div className="error">The database isn&apos;t connected.</div></main>;

  const { count: pendingReviews } = await db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending");
  const nav = (
    <nav className="nav-grid">
      <Link href="/admin/menu" className="menu-link"><span>Menu &amp; recipes</span><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></Link>
      <Link href="/admin/reviews" className="menu-link"><span>Reviews{pendingReviews ? ` · ${pendingReviews} new` : ""}</span><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></Link>
    </nav>
  );

  // Same rule as the shop: the oldest drop that hasn't closed yet is "this week".
  // Falls back to the most recent closed drop. ?drop=<id> picks another one.
  const { drop: picked } = await searchParams;
  const nowMs = Date.now();
  const { data: recentData } = await db.from("drops").select("*").order("opens_at", { ascending: false }).limit(10);
  const recent = recentData ?? [];
  const notClosed = recent.filter((d) => new Date(d.closes_at).getTime() >= nowMs)
    .sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime());
  const shopDrop = notClosed[0] ?? recent[0];
  const drop = recent.find((d) => d.id === picked) ?? shopDrop;
  const openNow = recent.filter((d) => new Date(d.opens_at).getTime() <= nowMs && new Date(d.closes_at).getTime() > nowMs);

  // Order counts per drop, for the drop switcher.
  const { data: countRows } = await db.from("orders").select("drop_id, status").in("drop_id", recent.length ? recent.map((d) => d.id) : ["00000000-0000-0000-0000-000000000000"]);
  const orderCount = new Map<string, number>();
  for (const r of countRows ?? []) if (r.status !== "cancelled") orderCount.set(r.drop_id, (orderCount.get(r.drop_id) ?? 0) + 1);
  const dropName = (d: { pickup_date?: string | null; pickup_label: string; opens_at: string }) =>
    d.pickup_date
      ? "pickup " + new Date(d.pickup_date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
      : "opened " + new Date(d.opens_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });

  if (!drop) {
    return (
      <main className="page admin">
        <AdminHeader title="this week" />
        {nav}
        <section className="card panel">No drops yet. Start one from Menu &amp; recipes.</section>
      </main>
    );
  }

  const [{ data: orderData }, { data: caps }] = await Promise.all([
    db.from("orders")
      .select("id, code, customer_name, customer_phone, pickup_slot, payment_method, status, total_cents, created_at, order_items(product_name, quantity, drop_item_id)")
      .eq("drop_id", drop.id)
      .order("created_at", { ascending: false }),
    db.from("drop_items").select("id, cap, sort, product_id, products(*)").eq("drop_id", drop.id).order("sort"),
  ]);
  const productIds = (caps ?? []).map((c) => c.product_id as string);
  // Fails quietly (no recipes) if the recipe table hasn't been created yet.
  const { data: recipeRows } = await db.from("recipe_ingredients").select("product_id, name, amount, unit, sort")
    .in("product_id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]).order("sort");

  const orders = (orderData ?? []) as OrderRow[];
  const live = orders.filter((o) => o.status !== "cancelled");
  // Abandoned card checkouts sit as "pending" for up to an hour; keep them out of the money owed.
  const owedOrders = live.filter((o) => o.status === "pending" && o.payment_method !== "card");
  const collected = live.filter((o) => o.status === "paid").reduce((a, o) => a + o.total_cents, 0);
  const owed = owedOrders.reduce((a, o) => a + o.total_cents, 0);

  const sold = new Map<string, number>();
  for (const o of live) for (const i of o.order_items) sold.set(i.drop_item_id, (sold.get(i.drop_item_id) ?? 0) + i.quantity);
  const bake = (caps ?? []).map((c) => {
    const p = c.products as unknown as { name: string; batch_yield?: number };
    return { id: c.id as string, productId: c.product_id as string, name: p.name, batchYield: p.batch_yield ?? 1, cap: c.cap as number, sold: sold.get(c.id as string) ?? 0 };
  });
  const needs: BakeNeeds[] = bake.map((b) => ({
    name: b.name, sold: b.sold, batchYield: Math.max(1, b.batchYield),
    ingredients: (recipeRows ?? []).filter((r) => r.product_id === b.productId)
      .map((r) => ({ name: r.name as string, amount: Number(r.amount), unit: r.unit as "g" | "ml" | "each" })),
  }));

  const isOpen = new Date(drop.opens_at) <= new Date() && new Date(drop.closes_at) > new Date();
  const sorted = [...live].sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid"));
  const cancelled = orders.length - live.length;

  return (
    <main className="page admin">
      <AdminHeader title="this week">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span className="chip" style={{ textTransform: "uppercase", letterSpacing: 0.4, fontSize: 11, border: "none" }}>
            <span className={`dot ${isOpen ? "open" : ""}`} />{isOpen ? "orders open" : new Date(drop.opens_at) > new Date() ? "opens soon" : "orders closed"}
          </span>
          {isOpen && (
            <form action={closeDropNow}>
              <input type="hidden" name="id" value={drop.id} />
              <button className="mini light">Close orders now</button>
            </form>
          )}
        </div>
        <span style={{ fontSize: 13, color: "#e9d8c2" }}>closes {formatDropTime(drop.closes_at)} · pickup {drop.pickup_label}</span>
      </AdminHeader>

      <section className="stats">
        <div style={{ background: "var(--butter)" }}><small>orders</small><b>{live.length}</b></div>
        <div style={{ background: "var(--sky)" }}><small>collected</small><b>{money(collected)}</b></div>
        <div style={{ background: "#fff" }}><small>waiting on</small><b>{money(owed)}</b></div>
      </section>

      {nav}

      {openNow.length > 1 && (
        <div className="error" role="alert">
          {openNow.length} drops are open at the same time. The shop only sells from the oldest one ({dropName(shopDrop)}).
          Delete or close the extra one below so this doesn&apos;t get confusing.
        </div>
      )}

      {recent.length > 1 && (
        <nav aria-label="Drops" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {recent.slice(0, 6).map((d) => (
            <Link key={d.id} href={d.id === shopDrop.id ? "/admin" : `/admin?drop=${d.id}`}
                  className="chip" aria-current={d.id === drop.id ? "page" : undefined}
                  style={{ flex: "none", minHeight: 44, padding: "0 14px", textDecoration: "none", background: d.id === drop.id ? "var(--butter)" : "#fff", boxShadow: d.id === drop.id ? "3px 3px 0 var(--ink)" : "none" }}>
              {d.id === shopDrop.id && <span className="dot open" />}
              {dropName(d)} · {orderCount.get(d.id) ?? 0} {(orderCount.get(d.id) ?? 0) === 1 ? "order" : "orders"}
            </Link>
          ))}
        </nav>
      )}

      {drop.id !== shopDrop.id && (
        <div className="notice">You&apos;re looking at an older or extra drop. <Link href="/admin">Back to the one the shop is selling</Link>.</div>
      )}

      <section className="card panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 24 }}>bake list</h2>
          <span className="allergens">for {drop.pickup_label}</span>
        </div>
        {bake.map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="display" style={{ fontSize: 36, minWidth: 48 }}>{b.sold}</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <b style={{ fontSize: 15 }}>{b.name}</b>
              <div className="bar"><div style={{ width: `${Math.min(100, Math.round((b.sold / Math.max(1, b.cap)) * 100))}%` }} /></div>
              <span className="allergens">{b.sold} of {b.cap} sold{b.batchYield > 1 && b.sold ? ` · ${Math.round((b.sold / b.batchYield) * 100) / 100} batches` : ""}</span>
            </div>
          </div>
        ))}
      </section>

      <IngredientList dropId={drop.id} bakes={needs} />

      <section className="card panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 24 }}>orders</h2>
        {sorted.length === 0 && <p style={{ margin: 0, fontSize: 14 }}>No orders yet.</p>}
        {orders.length === 0 && (
          <form action={deleteEmptyDrop}>
            <input type="hidden" name="id" value={drop.id} />
            <button className="mini danger">Delete this drop (it has no orders)</button>
          </form>
        )}
        {sorted.map((o) => {
          const abandoned = o.status === "pending" && o.payment_method === "card";
          return (
            <article key={o.id} className="order">
              <div className="line" style={{ alignItems: "baseline" }}>
                <b style={{ fontSize: 15 }}>{o.customer_name}</b>
                <span className="display" style={{ fontSize: 18 }}>{money(o.total_cents)}</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--body)" }}>
                {o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}
              </span>
              <span style={{ fontSize: 12, color: "var(--body)" }}>
                {o.pickup_slot} · {o.code} · <a href={`sms:${o.customer_phone}`}>{o.customer_phone}</a>
              </span>
              <div className="line" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <span className={`badge ${o.status === "paid" ? "ok" : "due"}`}>
                  {o.status === "paid" ? `paid · ${METHOD[o.payment_method]}` : abandoned ? "card checkout not finished" : `${METHOD[o.payment_method]} · not yet paid`}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  {o.status === "pending" && (
                    <form action={cancelOrder}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="mini ghost">Cancel</button>
                    </form>
                  )}
                  {o.status === "pending" && !abandoned && (
                    <form action={markPaid}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="mini">Mark paid</button>
                    </form>
                  )}
                  {o.status === "paid" && o.payment_method !== "card" && (
                    <form action={markUnpaid}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="mini ghost">Undo</button>
                    </form>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {cancelled > 0 && <p className="allergens">{cancelled} cancelled order{cancelled === 1 ? "" : "s"} not shown.</p>}
      </section>
    </main>
  );
}
