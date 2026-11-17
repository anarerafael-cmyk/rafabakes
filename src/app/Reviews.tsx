"use client";

import { useState } from "react";
import { SITE } from "@/lib/site";
import { Stars } from "./ui";

export type PublicReview = { id: string; name: string; rating: number; body: string };

const Star = ({ filled }: { filled: boolean }) => (
  <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={filled ? "#F6C860" : "none"}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </svg>
);

export default function Reviews({ reviews, average, total, orderToken }: {
  reviews: PublicReview[]; average: number | null; total: number; orderToken?: string;
}) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // hidden field that only bots fill in
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentName, setSentName] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rating, body, order: orderToken, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSentName(name.trim().split(" ")[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="reviews" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      <div className="section-head" style={{ margin: "0 4px" }}>
        <h2 className="section-title">reviews</h2>
        {average !== null && (
          <span style={{ fontWeight: 900, fontSize: 14 }}>
            <span style={{ color: "var(--caramel)" }}>★</span> {average.toFixed(1)} · {total} review{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="review-grid">
        {reviews.map((r) => (
          <article key={r.id} className="review">
            <div className="line" style={{ alignItems: "center" }}>
              <b style={{ fontSize: 15 }}>{r.name}</b>
              <Stars n={r.rating} />
            </div>
            <p style={{ margin: 0, lineHeight: 1.5, color: "var(--body)", whiteSpace: "pre-line" }}>{r.body}</p>
          </article>
        ))}
      </div>

      {sentName !== null ? (
        <div className="card summary" role="status" style={{ background: "var(--butter)" }}>
          <b className="display" style={{ fontSize: 24 }}>thanks, {sentName}!</b>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{SITE.reviewThanks}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="card summary" style={{ gap: 10 }}>
          <span className="display" style={{ fontSize: 22 }}>{reviews.length ? "leave a review" : "be the first to leave a review"}</span>
          <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Your rating</legend>
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
          <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
            <label htmlFor="rv-site">Website</label>
            <input id="rv-site" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="cta" style={{ fontSize: 18, minHeight: 54 }} disabled={busy}>{busy ? "Sending…" : "Post review"}</button>
        </form>
      )}
    </section>
  );
}
