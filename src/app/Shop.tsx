"use client";

import { useMemo, useState } from "react";
import { Drop, PaymentMethod, formatDropTime, money } from "@/lib/types";
import { SITE } from "@/lib/site";
import { BackArrow, Peaks, Ribbon, Ridge } from "./ui";

type Props = { drop: Drop; preview: boolean; venmo: string; zelle: string; cardEnabled: boolean; reviews?: React.ReactNode };

const CookieIcon = () => (
  <svg aria-hidden="true" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="32" cy="32" r="24" /><circle cx="24" cy="26" r="3" fill="currentColor" /><circle cx="38" cy="22" r="2.5" fill="currentColor" /><circle cx="40" cy="38" r="3" fill="currentColor" /><circle cx="26" cy="41" r="2.5" fill="currentColor" /></svg>
);

function joinWords(words: string[]) {
  if (words.length <= 1) return words.join("");
  return words.slice(0, -1).join(", ") + " or " + words[words.length - 1];
}

export default function Shop({ drop, preview, venmo, zelle, cardEnabled, reviews }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"menu" | "checkout">("menu");
  const [slot, setSlot] = useState(drop.pickupSlots[0] ?? drop.pickupLabel);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsTexts, setWantsTexts] = useState(true);
  const methods = useMemo(() => {
    const m: { id: PaymentMethod; title: string; short: string; sub: string }[] = [];
    if (cardEnabled || preview) m.push({ id: "card", title: "Card or Apple Pay", short: "card", sub: "Pay now, secured by Stripe" });
    if (venmo) m.push({ id: "venmo", title: "Venmo", short: "Venmo", sub: `Send to @${venmo}` });
    if (zelle) m.push({ id: "zelle", title: "Zelle", short: "Zelle", sub: `Send to ${zelle}` });
    return m;
  }, [cardEnabled, preview, venmo, zelle]);
  const [method, setMethod] = useState<PaymentMethod>(methods[0]?.id ?? "card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lines = drop.items.filter((i) => (qty[i.dropItemId] ?? 0) > 0);
  const count = lines.reduce((a, i) => a + qty[i.dropItemId], 0);
  const total = lines.reduce((a, i) => a + qty[i.dropItemId] * i.priceCents, 0);
  const closes = formatDropTime(drop.closesAt);

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
    const chosen = methods.find((m) => m.id === method);
    const cta = method === "card" ? `Pay ${money(total)}` : `Place order · pay with ${chosen?.title ?? ""}`;
    return (
      <main className="page">
        <header style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
          <button className="back" onClick={() => setStep("menu")} aria-label="Back to menu"><BackArrow /></button>
          <h1 style={{ fontSize: 30 }}>your order</h1>
        </header>

        <section className="card summary">
          {lines.map((i) => (
            <div className="line" key={i.dropItemId}>
              <span><b>{qty[i.dropItemId]} ×</b> {i.name}</span>
              <b>{money(qty[i.dropItemId] * i.priceCents)}</b>
            </div>
          ))}
          <div className="rule" />
          <div className="line" style={{ alignItems: "baseline" }}>
            <span className="display" style={{ fontSize: 19, fontWeight: 600 }}>total</span>
            <span className="display total">{money(total)}</span>
          </div>
          <span className="chip" style={{ alignSelf: "flex-start", border: "none", background: "var(--cream)" }}>no service fees, ever</span>
        </section>

        <form onSubmit={placeOrder} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {drop.pickupSlots.length > 0 && (
            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <legend className="display" style={{ fontSize: 22, marginBottom: 10 }}>pickup time</legend>
              <div className="choices two">
                {drop.pickupSlots.map((s) => (
                  <button type="button" key={s} className="choice slot" aria-pressed={slot === s} onClick={() => setSlot(s)}>
                    <b style={{ fontSize: 16 }}>{s}</b>
                  </button>
                ))}
              </div>
              {drop.pickupLocation && <p className="allergens" style={{ fontSize: 13 }}>{drop.pickupLocation} · exact spot comes with your confirmation</p>}
            </fieldset>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 22 }}>your info</h2>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" className="input" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone, for your pickup reminder</label>
              <input id="phone" className="input" type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <label className="check">
              <input type="checkbox" checked={wantsTexts} onChange={(e) => setWantsTexts(e.target.checked)} />
              Text me when the next drop opens
            </label>
          </div>

          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <legend className="display" style={{ fontSize: 22, marginBottom: 10 }}>how do you want to pay?</legend>
            <div className="choices">
              {methods.map((m) => (
                <button type="button" key={m.id} className="choice" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}>
                  <span className="radio" />
                  <span><b style={{ fontSize: 16 }}>{m.title}</b><small>{m.sub}</small></span>
                </button>
              ))}
            </div>
            {method !== "card" && (
              <div className="note">
                After you place your order you&apos;ll get an order code to put in the {method === "venmo" ? "Venmo note" : "Zelle memo"}.
                Your bakes are held until {closes}.
              </div>
            )}
          </fieldset>

          {error && <div className="error" role="alert">{error}</div>}
          <button className="cta" type="submit" disabled={busy || !lines.length}>{busy ? "One sec…" : cta}</button>
          <p className="center">Orders close {closes}.</p>
        </form>
      </main>
    );
  }

  const payWords = methods.filter((m) => m.id !== "card" || cardEnabled).map((m) => m.short);

  return (
    <main className="page">
      <header className="topbar">
        <img className="logo" src="/logo.png" alt="rafa sourdough & cookies" />
        <a className="pill-link" href="#how">How it works</a>
      </header>

      {preview && <div className="preview-banner">Preview mode: sample menu, ordering is off until the database is connected.</div>}

      <section className="hero">
        <img className="hero-photo" src={SITE.heroPhoto} alt="Sliced sourdough loaf with an airy crumb" />
        <div className="hero-body">
          <div className="hero-top">
            <h1>{drop.title}</h1>
            <span className="chip"><span className="dot open" />open</span>
          </div>
          <div className="facts">
            <div><span className="eyebrow" style={{ display: "block" }}>order by</span><b>{closes}</b></div>
            <div><span className="eyebrow" style={{ display: "block" }}>pick up</span><b>{drop.pickupLabel}</b></div>
          </div>
        </div>
      </section>

      <Ribbon words={SITE.ribbon} />

      <div className="section-head">
        <h2 className="section-title">the menu</h2>
        <span className="allergens" style={{ fontSize: 13 }}>{drop.items.length} {drop.items.length === 1 ? "bake" : "bakes"} this week</span>
      </div>

      <div className="menu-grid">
        {drop.items.map((i) => {
          const n = qty[i.dropItemId] ?? 0;
          return (
            <article className="card" key={i.dropItemId}>
              <div className="item-media">
                {i.imageUrl ? (
                  <img className="item-photo" src={i.imageUrl} alt={i.name} />
                ) : (
                  <div className="item-photo placeholder" aria-hidden="true"><CookieIcon /></div>
                )}
                {i.badge && <span className="chip item-badge" style={{ background: i.badge.toLowerCase().includes("new") ? "var(--sky)" : "var(--butter)" }}>{i.badge}</span>}
                <span className="price-sticker sticker">{money(i.priceCents)}</span>
              </div>
              <div className="item-body">
                <h3>{i.name}</h3>
                {i.description && <p className="desc">{i.description}</p>}
                {i.allergens.length > 0 && <p className="allergens">Contains: {i.allergens.join(", ")}</p>}
                <div className="item-foot">
                  <span className="left">{i.left > 0 ? `${i.left} left` : ""}</span>
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
      </div>

      <section id="how" className="card panel" style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
        <h2 style={{ fontSize: 24 }}>how it works</h2>
        <div className="steps">
          <div className="step"><span className="step-num">1</span><div><b>Order by {closes}</b><p>Pick your bakes and a pickup time.{payWords.length ? ` Pay by ${joinWords(payWords)}.` : ""}</p></div></div>
          <div className="step"><span className="step-num">2</span><div><b>Rafael bakes it fresh</b><p>{SITE.bakeStep}</p></div></div>
          <div className="step"><span className="step-num">3</span><div><b>Pick up {drop.pickupLabel}</b><p>{drop.pickupLocation ? `${drop.pickupLocation}. ` : ""}Exact spot comes with your confirmation.</p></div></div>
        </div>
      </section>

      <div style={{ marginTop: 18 }}>
        <Ridge />
        <section className="dark about">
          {SITE.aboutPhoto && <img className="about-photo" src={SITE.aboutPhoto} alt="Rafael" />}
          <div>
            <h2>hi, i&apos;m <span>rafael</span></h2>
            <p>{SITE.aboutText}</p>
          </div>
        </section>
      </div>

      {reviews}

      <p className="made-in"><Peaks />baked with love in colorado</p>
      <p className="fineprint">
        Made in a home kitchen that is not subject to state licensure or inspection and that may also process common food allergens.
      </p>

      {count > 0 && (
        <div className="cartbar">
          <button onClick={() => { setStep("checkout"); window.scrollTo(0, 0); }}>
            <span style={{ display: "flex", alignItems: "center" }}>
              <span className="count">{count}</span>View order
            </span>
            <span className="display" style={{ fontSize: 22 }}>{money(total)} →</span>
          </button>
        </div>
      )}
    </main>
  );
}
