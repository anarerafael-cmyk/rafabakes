"use client";

import { useMemo, useState } from "react";
import { Drop, PaymentMethod, formatDropTime, money } from "@/lib/types";

type Props = { drop: Drop; preview: boolean; venmo: string; zelle: string; cardEnabled: boolean };

const ClockIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const PinIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);

export default function Shop({ drop, preview, venmo, zelle, cardEnabled }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"menu" | "checkout">("menu");
  const [slot, setSlot] = useState(drop.pickupSlots[0] ?? drop.pickupLabel);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsTexts, setWantsTexts] = useState(true);
  const methods = useMemo(() => {
    const m: { id: PaymentMethod; title: string; sub: string }[] = [];
    if (cardEnabled || preview) m.push({ id: "card", title: "Card or Apple Pay", sub: "Pay now, secured by Stripe" });
    if (venmo) m.push({ id: "venmo", title: "Venmo", sub: `Send to @${venmo}` });
    if (zelle) m.push({ id: "zelle", title: "Zelle", sub: `Send to ${zelle}` });
    return m;
  }, [cardEnabled, preview, venmo, zelle]);
  const [method, setMethod] = useState<PaymentMethod>(methods[0]?.id ?? "card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lines = drop.items.filter((i) => (qty[i.dropItemId] ?? 0) > 0);
  const count = lines.reduce((a, i) => a + qty[i.dropItemId], 0);
  const total = lines.reduce((a, i) => a + qty[i.dropItemId] * i.priceCents, 0);
  const totalLeft = drop.items.reduce((a, i) => a + i.left, 0);

  const change = (id: string, d: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, (q[id] ?? 0) + d)) }));

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dropId: drop.id, name, phone, slot, method, wantsTexts,
          items: lines.map((i) => ({ dropItemId: i.dropItemId, quantity: qty[i.dropItemId] })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.href = data.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (step === "checkout") {
    const cta = method === "card" ? `Pay ${money(total)}` : `Place order · pay with ${method === "venmo" ? "Venmo" : "Zelle"}`;
    return (
      <main className="page">
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="back" onClick={() => setStep("menu")} aria-label="Back to menu">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>your order</h1>
        </header>

        <section className="card summary">
          {lines.map((i) => (
            <div className="line" key={i.dropItemId}>
              <span>{qty[i.dropItemId]} × {i.name}</span>
              <b>{money(qty[i.dropItemId] * i.priceCents)}</b>
            </div>
          ))}
          <div className="rule" />
          <div className="line" style={{ alignItems: "baseline" }}>
            <span className="display" style={{ fontSize: 18, fontWeight: 600 }}>total</span>
            <span className="display total">{money(total)}</span>
          </div>
          <p className="allergens">No service fees. What you see is what you pay.</p>
        </section>

        <form onSubmit={placeOrder} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {drop.pickupSlots.length > 0 && (
            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <legend className="display" style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>pickup time</legend>
              <div className="choices two">
                {drop.pickupSlots.map((s) => (
                  <button type="button" key={s} className="choice slot" aria-pressed={slot === s} onClick={() => setSlot(s)}>
                    <b style={{ fontSize: 14 }}>{s}</b>
                  </button>
                ))}
              </div>
              {drop.pickupLocation && <p className="allergens">{drop.pickupLocation}</p>}
            </fieldset>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>your info</h2>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" className="input" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone (for pickup reminders)</label>
              <input id="phone" className="input" type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <label className="check">
              <input type="checkbox" checked={wantsTexts} onChange={(e) => setWantsTexts(e.target.checked)} />
              Text me when the next drop opens
            </label>
          </div>

          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <legend className="display" style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>how do you want to pay?</legend>
            <div className="choices">
              {methods.map((m) => (
                <button type="button" key={m.id} className="choice" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}>
                  <span className="radio" />
                  <span><b style={{ fontSize: 15 }}>{m.title}</b><small>{m.sub}</small></span>
                </button>
              ))}
            </div>
            {method !== "card" && (
              <div className="note" style={{ background: method === "venmo" ? "#ffe3ef" : "#fbf0c2" }}>
                After you place your order, you&apos;ll get your order code to put in the {method === "venmo" ? "Venmo note" : "Zelle memo"}.
                Your order is held until {formatDropTime(drop.closesAt)}.
              </div>
            )}
          </fieldset>

          {error && <div className="error" role="alert">{error}</div>}
          <button className="cta" type="submit" disabled={busy || !lines.length}>{busy ? "One sec…" : cta}</button>
          <p className="center">Orders close {formatDropTime(drop.closesAt)}.</p>
        </form>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <img className="logo" src="/logo.png" alt="rafa sourdough & cookies" />
        <a className="pill-link" href="#about">About</a>
      </header>

      {preview && <div className="preview-banner">Preview mode: sample menu, ordering is off until the database is connected.</div>}

      <section className="panel hero">
        <h1>{drop.title}</h1>
        <div className="meta">
          <span className="meta-row"><ClockIcon /> Orders close <b>{formatDropTime(drop.closesAt)}</b></span>
          <span className="meta-row"><PinIcon /> Pickup <b>{drop.pickupLabel}</b></span>
        </div>
        <span className="chip dark"><span className="dot" />{totalLeft > 0 ? `${totalLeft} left this week` : "sold out"}</span>
      </section>

      <h2 className="section-title">the menu</h2>

      {drop.items.map((i) => {
        const n = qty[i.dropItemId] ?? 0;
        return (
          <article className="card" key={i.dropItemId}>
            {i.imageUrl ? (
              <img className="item-photo" src={i.imageUrl} alt={i.name} />
            ) : (
              <div className="item-photo placeholder" aria-hidden="true">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="32" cy="32" r="24" /><circle cx="24" cy="26" r="3" fill="currentColor" /><circle cx="38" cy="22" r="2.5" fill="currentColor" /><circle cx="40" cy="38" r="3" fill="currentColor" /><circle cx="26" cy="41" r="2.5" fill="currentColor" /></svg>
              </div>
            )}
            <div className="item-body">
              <div className="item-head">
                <h3>{i.name}</h3>
                <span className="display price">{money(i.priceCents)}</span>
              </div>
              {i.description && <p className="desc">{i.description}</p>}
              {i.allergens.length > 0 && <p className="allergens">Contains: {i.allergens.join(", ")}</p>}
              <div className="item-foot">
                {i.badge ? <span className="chip" style={{ background: "var(--pink)" }}>{i.badge}</span> : <span />}
                {i.left > 0 ? (
                  <div className="stepper">
                    <button aria-label={`Remove one ${i.name}`} onClick={() => change(i.dropItemId, -1, i.left)} disabled={n === 0}>−</button>
                    <span aria-live="polite">{n}</span>
                    <button className="plus" aria-label={`Add one ${i.name}`} onClick={() => change(i.dropItemId, 1, i.left)} disabled={n >= i.left}>+</button>
                  </div>
                ) : (
                  <span className="soldout">sold out</span>
                )}
              </div>
            </div>
          </article>
        );
      })}

      <section id="about" className="panel about">
        <h2>homemade.<br />small batch.<br />big flavor.</h2>
        <div className="tags">
          <span>naturally fermented</span>
          <span>simple, real ingredients</span>
          <span>no preservatives</span>
        </div>
      </section>

      <p className="fineprint">
        Made in a home kitchen that is not subject to state licensure or inspection and that may also process common food allergens.
      </p>

      {count > 0 && (
        <div className="cartbar">
          <button onClick={() => { setStep("checkout"); window.scrollTo(0, 0); }}>
            <span style={{ display: "flex", alignItems: "center", fontWeight: 500, fontSize: 14 }}>
              <span className="count">{count}</span>View order
            </span>
            <span className="display" style={{ fontWeight: 600, fontSize: 20 }}>{money(total)}</span>
          </button>
        </div>
      )}
    </main>
  );
}
