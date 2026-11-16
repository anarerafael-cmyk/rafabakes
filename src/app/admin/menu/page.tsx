import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { isoToDenverLocal, WEEK_MS } from "@/lib/denver";
import { getDb } from "@/lib/server";
import { ALLERGENS, money } from "@/lib/types";
import PhotoInput from "./PhotoInput";
import { addProduct, archiveProduct, createDrop, toggleProduct, updateCaps, updateProduct } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "menu & drop · rafa", robots: { index: false } };

type Product = {
  id: string; name: string; description: string; price_cents: number; allergens: string[];
  image_url: string | null; badge: string | null; active: boolean;
};

function ProductFields({ p, idPrefix }: { p?: Product; idPrefix: string }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-name`}>Name</label>
        <input id={`${idPrefix}-name`} name="name" className="input" required defaultValue={p?.name} placeholder="e.g. jalapeño cheddar" />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-price`}>Price ($)</label>
        <input id={`${idPrefix}-price`} name="price" className="input" type="number" inputMode="decimal" step="0.01" min="0.5" required
               defaultValue={p ? (p.price_cents / 100).toString() : ""} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-desc`}>Description</label>
        <textarea id={`${idPrefix}-desc`} name="description" className="input textarea" rows={2} defaultValue={p?.description} />
      </div>
      <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Contains</legend>
        <div className="chips">
          {ALLERGENS.map((a) => (
            <label key={a} className="chipbox">
              <input type="checkbox" name={`allergen_${a}`} defaultChecked={p ? p.allergens.includes(a) : a === "wheat"} />
              <span>{a}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${idPrefix}-badge`}>Tag (optional)</label>
        <input id={`${idPrefix}-badge`} name="badge" className="input" defaultValue={p?.badge ?? ""} placeholder="new, small batch, seasonal…" />
      </div>
      <PhotoInput id={`${idPrefix}-photo`} current={p?.image_url} />
    </>
  );
}

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const db = getDb();
  if (!db) return <main className="page admin"><div className="error">The database isn&apos;t connected.</div></main>;
  const { msg } = await searchParams;

  const [{ data: productData }, { data: lastDrops }] = await Promise.all([
    db.from("products").select("*").eq("archived", false).order("created_at"),
    db.from("drops").select("*, drop_items(id, cap, product_id)").order("opens_at", { ascending: false }).limit(1),
  ]);
  const products = (productData ?? []) as Product[];
  const last = lastDrops?.[0] as
    | { id: string; opens_at: string; closes_at: string; pickup_label: string; pickup_location: string; pickup_slots: string[];
        drop_items: { id: string; cap: number; product_id: string }[] }
    | undefined;

  const now = Date.now();
  const lastStillRunning = last && new Date(last.closes_at).getTime() > now;
  const lastCap = new Map((last?.drop_items ?? []).map((d) => [d.product_id, d.cap]));
  const productName = new Map(products.map((p) => [p.id, p.name]));

  // "Copy last week": same times one week later (keep pushing forward until it's in the future).
  let opens = last ? new Date(last.opens_at).getTime() : now + 864e5;
  let closes = last ? new Date(last.closes_at).getTime() : now + 4 * 864e5;
  if (last) while (closes <= now) { opens += WEEK_MS; closes += WEEK_MS; }
  if (lastStillRunning) { opens += WEEK_MS; closes += WEEK_MS; }

  const active = products.filter((p) => p.active);

  return (
    <main className="page admin">
      <header style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--paper)" }}>
        <Link href="/admin" className="back light" aria-label="Back to this week">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <div>
          <span style={{ fontSize: 12, color: "var(--line)" }}>baker view</span>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>menu &amp; drop</h1>
        </div>
      </header>

      {msg && <div className="notice" role="status">{msg}</div>}

      {lastStillRunning && last && last.drop_items.length > 0 && (
        <form action={updateCaps} className="panel" style={{ background: "var(--paper)", display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>this drop&apos;s amounts</h2>
          <p className="allergens" style={{ margin: 0 }}>Made extra, or running short? Change how many are for sale right now.</p>
          {last.drop_items.map((d) => (
            <div key={d.id} className="line" style={{ alignItems: "center" }}>
              <input type="hidden" name="drop_item_id" value={d.id} />
              <label htmlFor={`cap-${d.id}`} style={{ fontSize: 14, fontWeight: 600 }}>{productName.get(d.product_id) ?? "bake"}</label>
              <input id={`cap-${d.id}`} name={`cap_${d.id}`} type="number" min="0" className="input" style={{ width: 90 }} defaultValue={d.cap} />
            </div>
          ))}
          <button className="mini" style={{ alignSelf: "flex-end" }}>Save amounts</button>
        </form>
      )}

      <section className="panel" style={{ background: "var(--butter)", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>start the next drop</h2>
        <p style={{ margin: 0, fontSize: 13 }}>
          {last ? "Filled in from last week, one week later. Change anything, then start it." : "Set the times and how many of each bake you'll make."}
        </p>
        {active.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14 }}>Turn on at least one bake below first.</p>
        ) : (
          <form action={createDrop} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="two-col">
              <div className="field">
                <label htmlFor="opens_at">Orders open</label>
                <input id="opens_at" name="opens_at" type="datetime-local" className="input" required defaultValue={isoToDenverLocal(new Date(opens).toISOString())} />
              </div>
              <div className="field">
                <label htmlFor="closes_at">Orders close</label>
                <input id="closes_at" name="closes_at" type="datetime-local" className="input" required defaultValue={isoToDenverLocal(new Date(closes).toISOString())} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pickup_label">Pickup (shown on the shop)</label>
              <input id="pickup_label" name="pickup_label" className="input" required defaultValue={last?.pickup_label ?? "Sat, 9–11 AM"} />
            </div>
            <div className="field">
              <label htmlFor="pickup_slots">Pickup times customers choose from (one per line)</label>
              <textarea id="pickup_slots" name="pickup_slots" className="input textarea" rows={3} defaultValue={(last?.pickup_slots ?? ["Sat 9–10 AM", "Sat 10–11 AM"]).join("\n")} />
            </div>
            <div className="field">
              <label htmlFor="pickup_location">Pickup spot</label>
              <input id="pickup_location" name="pickup_location" className="input" defaultValue={last?.pickup_location ?? ""} />
            </div>
            <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <legend style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>How many of each (0 = not this week)</legend>
              {active.map((p) => (
                <div key={p.id} className="line" style={{ alignItems: "center", background: "var(--paper)", borderRadius: 14, padding: "6px 6px 6px 14px" }}>
                  <label htmlFor={`cap-new-${p.id}`} style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</label>
                  <input id={`cap-new-${p.id}`} name={`cap_${p.id}`} type="number" min="0" className="input" style={{ width: 90 }} defaultValue={lastCap.get(p.id) ?? 8} />
                </div>
              ))}
            </fieldset>
            <button className="cta" style={{ fontSize: 18, minHeight: 56 }}>Start this drop</button>
          </form>
        )}
      </section>

      <section className="panel" style={{ background: "var(--paper)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="line" style={{ alignItems: "baseline" }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>your bakes</h2>
          <span className="allergens">{active.length} on the menu</span>
        </div>
        {products.map((p) => (
          <article key={p.id} className="order" style={{ opacity: p.active ? 1 : 0.75 }}>
            <div className="line" style={{ alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                {p.image_url
                  ? <img src={p.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flex: "none" }} />
                  : <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--lilac)", flex: "none" }} />}
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 15 }}>{p.name}</b>
                  <div className="allergens">{money(p.price_cents)}{p.allergens.length ? ` · contains ${p.allergens.join(", ")}` : ""}</div>
                </div>
              </div>
              <form action={toggleProduct}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="active" value={String(!p.active)} />
                <button className={`mini ${p.active ? "" : "ghost"}`} aria-pressed={p.active}>{p.active ? "On menu" : "Off"}</button>
              </form>
            </div>
            <details>
              <summary className="summary-link">Edit</summary>
              <form action={updateProduct} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                <input type="hidden" name="id" value={p.id} />
                <ProductFields p={p} idPrefix={`e-${p.id}`} />
                <button className="mini" style={{ minHeight: 48 }}>Save changes</button>
              </form>
              <form action={archiveProduct} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={p.id} />
                <button className="mini ghost danger">Delete this bake</button>
              </form>
            </details>
          </article>
        ))}
      </section>

      <section className="panel" style={{ background: "var(--pink)" }}>
        <form action={addProduct} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>add a bake</h2>
          <ProductFields idPrefix="new" />
          <button className="cta" style={{ fontSize: 18, minHeight: 56 }}>Add to menu</button>
          <p style={{ margin: 0, fontSize: 12 }}>New bakes show up in the next drop you start.</p>
        </form>
      </section>
    </main>
  );
}
