"use client";

import { useState } from "react";

export type PublicReview = { id: string; name: string; rating: number; body: string };

const Star = ({ filled }: { filled: boolean }) => (
  <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={filled ? "var(--butter)" : "none"}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </svg>
);

export default function Reviews({ reviews, average, total, prefillCode }: {
  reviews: PublicReview[]; average: number | null; total: number; prefillCode?: string;
}) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [code, setCode] = useState(prefillCode ?? "");
  const [last4, setLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phoneLast4: last4, name, rating, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="reviews" className="panel" style={{ background: "var(--lilac)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="line" style={{ alignItems: "baseline" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700 }}>reviews</h2>
        {average !== null && (
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {"★".repeat(Math.round(average))} {average.toFixed(1)} · {total} review{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {reviews.length === 0 && (
        <div className="review">No reviews yet. Picked up an order? Be the first to say how it was.</div>
      )}
      <div className="review-grid">
        {reviews.map((r) => (
          <article key={r.id} className="review">
            <div className="line" style={{ alignItems: "center" }}>
              <b style={{ fontSize: 14 }}>{r.name}</b>
              <span role="img" aria-label={`${r.rating} out of 5 stars`} style={{ letterSpacing: 2 }}>
                {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line" }}>{r.body}</p>
          </article>
        ))}
      </div>

      {sent ? (
        <div className="card summary" role="status">
          <b className="display" style={{ fontSize: 20 }}>thank you!</b>
          <span style={{ fontSize: 14 }}>Your review will show here once Rafael approves it.</span>
        </div>
      ) : (
        <form onSubmit={submit} className="card summary" style={{ gap: 10 }}>
          <span className="display" style={{ fontSize: 20, fontWeight: 600 }}>leave a review</span>
          <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Your rating</legend>
            <div style={{ display: "flex", gap: 2 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className="starbtn" onClick={() => setRating(n)}
                        aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={rating === n}>
                  <Star filled={n <= rating} />
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="rv-name">First name</label>
            <input id="rv-name" className="input" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rv-body">How was it?</label>
            <textarea id="rv-body" className="input textarea" rows={3} required maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="two-col">
            <div className="field">
              <label htmlFor="rv-code">Order code</label>
              <input id="rv-code" className="input" required placeholder="RAFA-1042" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rv-phone">Last 4 of your phone</label>
              <input id="rv-phone" className="input" required inputMode="numeric" maxLength={4} pattern="\d{4}" value={last4} onChange={(e) => setLast4(e.target.value)} />
            </div>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="cta" style={{ fontSize: 18, minHeight: 52 }} disabled={busy}>{busy ? "Sending…" : "Post review"}</button>
          <span className="allergens">Only customers can review. Rafael approves each review before it shows.</span>
        </form>
      )}
    </section>
  );
}
