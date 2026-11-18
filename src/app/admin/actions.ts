"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, isAdmin, passwordMatches, startSession } from "@/lib/auth";
import { getDb } from "@/lib/server";

export async function login(_: string | null, form: FormData): Promise<string | null> {
  // Small delay makes password guessing slow.
  await new Promise((r) => setTimeout(r, 600));
  if (!passwordMatches(String(form.get("password") ?? ""))) return "That password didn't work.";
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin");
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not signed in");
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  return db;
}

export async function markPaid(form: FormData) {
  const db = await requireAdmin();
  await db.from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", String(form.get("id")))
    .eq("status", "pending");
  revalidatePath("/admin");
}

export async function markUnpaid(form: FormData) {
  const db = await requireAdmin();
  await db.from("orders")
    .update({ status: "pending", paid_at: null })
    .eq("id", String(form.get("id")))
    .eq("status", "paid")
    .neq("payment_method", "card"); // card payments are confirmed by Stripe
  revalidatePath("/admin");
}

export async function cancelOrder(form: FormData) {
  const db = await requireAdmin();
  await db.from("orders").update({ status: "cancelled" }).eq("id", String(form.get("id"))).eq("status", "pending");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function closeDropNow(form: FormData) {
  const db = await requireAdmin();
  await db.from("drops").update({ closes_at: new Date().toISOString() }).eq("id", String(form.get("id")));
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteEmptyDrop(form: FormData) {
  const db = await requireAdmin();
  const id = String(form.get("id"));
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("drop_id", id);
  if (count) return; // never delete a drop that has orders, even cancelled ones
  await db.from("drop_items").delete().eq("drop_id", id);
  await db.from("drops").delete().eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}
