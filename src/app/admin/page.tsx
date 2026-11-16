import type { Metadata } from "next";
import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/server";
import { formatDropTime, money } from "@/lib/types";
import LoginForm from "./LoginForm";
import { cancelOrder, closeDropNow, logout, markPaid, markUnpaid } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "baker view · rafa", robots: { index: false } };

type OrderRow = {
  id: string; code: string; customer_name: string; customer_phone: string; pickup_slot: string;
  payment_method: "card" | "venmo" | "zelle"; status: "pending" | "paid" | "cancelled";
  total_cents: number; created_at: string;
  order_items: { product_name: string; quantity: number }[];
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

  const now = new Date().toISOString();
  const { data: opened } = await db.from("drops").select("*").lte("opens_at", now).order("opens_at", { ascending: false }).limit(1);
  const { data: upcoming } = await db.from("drops").select("*").gt("opens_at", now).order("opens_at").limit(1);
  const drop = opened?.[0] ?? upcoming?.[0];

  if (!drop) {
    return (
      <main className="page admin">
        <AdminHeader />
        <Link href="/admin/menu" className="menu-link">
        <span>Edit menu &amp; start next drop</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </Link>
        <section className="panel" style={{ background: "var(--paper)" }}>No drops yet. Start one from the menu page.</section>
      </main>
    );
  }

  const [{ data: orderData }, { data: caps }] = await Promise.all([
    db.from("orders")
      .select("id, code, customer_name, customer_phone, pickup_slot, payment_method, status, total_cents, created_at, order_items(product_name, quantity)")
      .eq("drop_id", drop.id)
      .order("created_at", { ascending: false }),
    db.from("drop_items").select("cap, sort, products(name)").eq("drop_id", drop.id).order("sort"),
  ]);

  const orders = (orderData ?? []) as OrderRow[];
  const live = orders.filter((o) => o.status !== "cancelled");
  // Abandoned card checkouts sit as "pending" for up to an hour; keep them out of the money owed.
  const owedOrders = live.filter((o) => o.status === "pending" && o.payment_method !== "card");
  const collected = live.filter((o) => o.status === "paid").reduce((a, o) => a + o.total_cents, 0);
  const owed = owedOrders.reduce((a, o) => a + o.total_cents, 0);

  const sold = new Map<string, number>();
  for (const o of live) for (const i of o.order_items) sold.set(i.product_name, (sold.get(i.product_name) ?? 0) + i.quantity);
  const bake = (caps ?? []).map((c) => {
    const name = (c.products as unknown as { name: string }).name;
    return { name, cap: c.cap as number, sold: sold.get(name) ?? 0 };
  });

  const isOpen = new Date(drop.opens_at) <= new Date() && new Date(drop.closes_at) > new Date();
  const sorted = [...live].sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid"));
  const cancelled = orders.length - live.length;

  return (
    <main className="page admin">
      <AdminHeader />
      <Link href="/admin/menu" className="menu-link">
        <span>Edit menu &amp; start next drop</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </Link>

      <section className="panel" style={{ background: "var(--paper)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span className={`status ${isOpen ? "" : "closed"}`}>{isOpen ? "orders open" : new Date(drop.opens_at) > new Date() ? "opens soon" : "orders closed"}</span>
          {isOpen && (
            <form action={closeDropNow}>
              <input type="hidden" name="id" value={drop.id} />
              <button className="mini">Close orders now</button>
            </form>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13 }}>
          {formatDropTime(drop.opens_at)} – {formatDropTime(drop.closes_at)} · pickup {drop.pickup_label}
        </p>
      </section>

      <section className="stats">
        <div style={{ background: "var(--butter)" }}><small>orders</small><b>{live.length}</b></div>
        <div style={{ background: "var(--pink)" }}><small>collected</small><b>{money(collected)}</b></div>
        <div style={{ background: "var(--lilac)" }}><small>waiting on</small><b>{money(owed)}</b></div>
      </section>

      <section className="panel" style={{ background: "var(--paper)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>bake list</h2>
          <span className="allergens">for {drop.pickup_label}</span>
        </div>
        {bake.map((b) => (
          <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="display" style={{ fontSize: 34, fontWeight: 700, minWidth: 52 }}>{b.sold}</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <b style={{ fontSize: 14 }}>{b.name}</b>
              <div className="bar"><div style={{ width: `${Math.min(100, Math.round((b.sold / Math.max(1, b.cap)) * 100))}%` }} /></div>
              <span className="allergens">{b.sold} of {b.cap} sold</span>
            </div>
          </div>
        ))}
      </section>

      <section className="panel" style={{ background: "var(--paper)", display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>orders</h2>
        {sorted.length === 0 && <p style={{ margin: 0, fontSize: 14 }}>No orders yet.</p>}
        {sorted.map((o) => {
          const abandoned = o.status === "pending" && o.payment_method === "card";
          return (
            <article key={o.id} className="order">
              <div className="line" style={{ alignItems: "baseline" }}>
                <b style={{ fontSize: 15 }}>{o.customer_name}</b>
                <span className="display" style={{ fontSize: 18, fontWeight: 600 }}>{money(o.total_cents)}</span>
              </div>
              <span style={{ fontSize: 12, color: "#4a4744" }}>
                {o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}
              </span>
              <span style={{ fontSize: 12, color: "#4a4744" }}>
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

function AdminHeader() {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--paper)" }}>
      <div>
        <span style={{ fontSize: 12, color: "var(--line)" }}>baker view</span>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>this week</h1>
      </div>
      <form action={logout}><button className="mini ghost light">Sign out</button></form>
    </header>
  );
}
