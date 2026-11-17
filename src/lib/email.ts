import "server-only";
import { getDb, siteUrl } from "./server";
import { money } from "./types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Sends a note to Rafael. Never throws: an email problem must not break an order. */
async function sendAlert(subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Resend's shared sender works without setting up a domain (it can only email you).
        from: "rafa bakes <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) console.error("alert email failed", res.status, await res.text());
  } catch (err) {
    console.error("alert email failed", err);
  }
}

const METHOD: Record<string, string> = { card: "Card", venmo: "Venmo", zelle: "Zelle" };

/** Email Rafael about one order. kind: "new" when placed, "paid" when a card payment lands. */
export async function alertOrder(orderId: string, kind: "new" | "paid") {
  const db = getDb();
  if (!db) return;
  const { data: o } = await db
    .from("orders")
    .select("code, customer_name, customer_phone, pickup_slot, payment_method, status, total_cents, order_items(product_name, quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return;

  const items = (o.order_items as { product_name: string; quantity: number }[])
    .map((i) => `<li>${i.quantity} × ${esc(i.product_name)}</li>`).join("");
  const method = METHOD[o.payment_method] ?? o.payment_method;
  const subject = kind === "paid"
    ? `Paid: ${o.code} · ${money(o.total_cents)} by card`
    : `New order ${o.code} · ${money(o.total_cents)} · ${method}`;
  const payLine = kind === "paid"
    ? "Paid by card. Nothing to do."
    : o.payment_method === "card"
      ? "Paying by card now. You'll get a second email when it goes through."
      : `Waiting on ${method}. Look for "${o.code}" in the note, then tap Mark paid.`;

  await sendAlert(subject, `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; color: #2A1A12; max-width: 480px">
      <h2 style="margin: 0 0 8px">${kind === "paid" ? "Payment received" : "New order"} · ${esc(o.code)}</h2>
      <p style="margin: 0 0 12px"><b>${esc(o.customer_name)}</b> · ${esc(o.customer_phone)}<br>Pickup: ${esc(o.pickup_slot)}</p>
      <ul style="margin: 0 0 12px; padding-left: 18px">${items}</ul>
      <p style="margin: 0 0 12px"><b>Total ${money(o.total_cents)}</b> · ${esc(method)}<br>${esc(payLine)}</p>
      <p style="margin: 0"><a href="${siteUrl()}/admin" style="color: #B85A22">Open the baker view</a></p>
    </div>`);
}
