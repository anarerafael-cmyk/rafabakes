import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/server";
import AdminHeader from "../Header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "reviews · rafa", robots: { index: false } };

type Review = {
  id: string; name: string; rating: number; body: string; status: "pending" | "approved" | "hidden";
  created_at: string; orders: { code: string; customer_name: string } | null;
};

async function setStatus(form: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not signed in");
  const db = getDb();
  const status = String(form.get("status"));
  if (!db || !["approved", "hidden", "pending"].includes(status)) return;
  await db.from("reviews").update({ status }).eq("id", String(form.get("id")));
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  revalidatePath("/");
}

export default async function ReviewsAdmin() {
  if (!(await isAdmin())) redirect("/admin");
  const db = getDb();
  if (!db) return <main className="page admin"><div className="error">The database isn&apos;t connected.</div></main>;

  const { data } = await db
    .from("reviews")
    .select("id, name, rating, body, status, created_at, orders(code, customer_name)")
    .order("created_at", { ascending: false });
  const reviews = (data ?? []) as unknown as Review[];
  const groups: { title: string; items: Review[] }[] = [
    { title: "new, waiting for you", items: reviews.filter((r) => r.status === "pending") },
    { title: "showing on the site", items: reviews.filter((r) => r.status === "approved") },
    { title: "hidden", items: reviews.filter((r) => r.status === "hidden") },
  ];

  return (
    <main className="page admin">
      <AdminHeader title="reviews" back="/admin" />

      {groups.map((g) => (
        <section key={g.title} className="card panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="line" style={{ alignItems: "baseline" }}>
            <h2 style={{ fontSize: 24 }}>{g.title}</h2>
            <span className="allergens">{g.items.length}</span>
          </div>
          {g.items.length === 0 && <p style={{ margin: 0, fontSize: 14 }}>None right now.</p>}
          {g.items.map((r) => (
            <article key={r.id} className="order">
              <div className="line" style={{ alignItems: "center" }}>
                <b style={{ fontSize: 15 }}>{r.name}</b>
                <span aria-label={`${r.rating} out of 5 stars`} role="img" style={{ letterSpacing: 2 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line" }}>{r.body}</p>
              {r.orders
                ? <span className="allergens"><span className="badge ok" style={{ padding: "3px 8px", marginRight: 6 }}>verified order</span>{r.orders.code} · ordered as {r.orders.customer_name}</span>
                : <span className="allergens">left from the shop page</span>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {r.status !== "hidden" && (
                  <form action={setStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="hidden" /><button className="mini ghost">Hide</button></form>
                )}
                {r.status !== "approved" && (
                  <form action={setStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="approved" /><button className="mini">Approve</button></form>
                )}
              </div>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
