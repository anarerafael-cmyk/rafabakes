import type { Metadata } from "next";
import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/server";
import { formatDropTime, money } from "@/lib/types";
import AdminHeader from "./Header";
import IngredientList, { type BakeNeeds } from "./IngredientList";
import LoginForm from "./LoginForm";
import { cancelOrder, closeDropNow, markPaid, markUnpaid } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "baker view · rafa", robots: { index: false } };

type OrderRow = {
  id: string; code: string; customer_name: string; customer_phone: string; pickup_slot: string;
  payment_method: "card" | "venmo" | "zelle"; status: "pending" | "paid" | "cancelled";
  total_cents: number; created_at: string;
  order_items: { product_name: string; quantity: number; drop_item_id: string }[];
};

const METHOD = { card: "Card", venmo: "Venmo", zelle: "Zelle" } as const;

export default async function AdminPage() {
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

  const now = new Date().toISOString();
  const { data: opened } = await db.from("drops").select("*").lte("opens_at", now).order("opens_at", { ascending: false }).limit(1);
  const { data: upcoming } = await db.from("drops").select("*").gt("opens_at", now).order("opens_at").limit(1);
  const drop = opened?.[0] ?? upcoming?.[0];

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
