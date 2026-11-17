"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { denverLocalToIso } from "@/lib/denver";
import { getDb } from "@/lib/server";
import { ALLERGENS } from "@/lib/types";


async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not signed in");
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  return db;
}

function refresh() {
  revalidatePath("/admin/menu");
  revalidatePath("/admin");
  revalidatePath("/");
}

const back = (msg: string) => redirect(`/admin/menu?msg=${encodeURIComponent(msg)}`);

function readProduct(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const price = Math.round(parseFloat(String(form.get("price") ?? "")) * 100);
  return {
    name,
    price_cents: price,
    description: String(form.get("description") ?? "").trim().slice(0, 400),
    badge: String(form.get("badge") ?? "").trim().slice(0, 24) || null,
    allergens: ALLERGENS.filter((a) => form.get(`allergen_${a}`) === "on"),
    valid: Boolean(name) && Number.isFinite(price) && price > 0,
  };
}

async function uploadPhoto(db: Awaited<ReturnType<typeof requireAdmin>>, form: FormData): Promise<string | null> {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;
  const path = `products/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from("photos").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Photo upload failed: " + error.message);
  return db.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

export async function addProduct(form: FormData) {
  const db = await requireAdmin();
  const p = readProduct(form);
  if (!p.valid) back("Add a name and a price.");
  const image_url = await uploadPhoto(db, form);
  await db.from("products").insert({
    name: p.name, price_cents: p.price_cents, description: p.description,
    badge: p.badge, allergens: p.allergens, image_url, active: true,
  });
  refresh();
  back(`Added ${p.name}.`);
}

export async function updateProduct(form: FormData) {
  const db = await requireAdmin();
  const id = String(form.get("id"));
  const p = readProduct(form);
  if (!p.valid) back("Each bake needs a name and a price.");
  const image_url = await uploadPhoto(db, form);
  await db.from("products").update({
    name: p.name, price_cents: p.price_cents, description: p.description,
    badge: p.badge, allergens: p.allergens, ...(image_url ? { image_url } : {}),
  }).eq("id", id);
  refresh();
  back(`Saved ${p.name}.`);
}

export async function toggleProduct(form: FormData) {
  const db = await requireAdmin();
  await db.from("products").update({ active: form.get("active") === "true" }).eq("id", String(form.get("id")));
  refresh();
}

export async function archiveProduct(form: FormData) {
  const db = await requireAdmin();
  await db.from("products").update({ archived: true, active: false }).eq("id", String(form.get("id")));
  refresh();
  back("Bake deleted.");
}

export async function createDrop(form: FormData) {
  const db = await requireAdmin();
  const opens = denverLocalToIso(String(form.get("opens_at") ?? ""));
  const closes = denverLocalToIso(String(form.get("closes_at") ?? ""));
  if (!opens || !closes || new Date(closes) <= new Date(opens)) back("Check the open and close times. Close has to be after open.");

  const slots = String(form.get("pickup_slots") ?? "")
    .split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12);

  const { data: products } = await db.from("products").select("id").eq("active", true).eq("archived", false);
  const items = (products ?? [])
    .map((p, i) => ({ product_id: p.id, cap: Math.max(0, Math.floor(Number(form.get(`cap_${p.id}`)) || 0)), sort: i }))
    .filter((i) => i.cap > 0);
  if (!items.length) back("Turn on at least one bake and give it a number to make.");

  const { data: drop, error } = await db.from("drops").insert({
    opens_at: opens,
    closes_at: closes,
    pickup_label: String(form.get("pickup_label") ?? "").trim().slice(0, 60) || "Pickup",
    pickup_location: String(form.get("pickup_location") ?? "").trim().slice(0, 200),
    pickup_slots: slots,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(String(form.get("pickup_date") ?? "")) ? { pickup_date: String(form.get("pickup_date")) } : {}),
  }).select("id").single();
  if (error || !drop) back("Couldn't create the drop. Try again.");

  await db.from("drop_items").insert(items.map((i) => ({ ...i, drop_id: drop!.id })));
  refresh();
  redirect("/admin");
}

export async function updateCaps(form: FormData) {
  const db = await requireAdmin();
  const ids = form.getAll("drop_item_id").map(String);
  for (const id of ids) {
    const cap = Math.max(0, Math.floor(Number(form.get(`cap_${id}`)) || 0));
    await db.from("drop_items").update({ cap }).eq("id", id);
  }
  refresh();
  back("Amounts updated.");
}

export async function saveRecipe(
  productId: string,
  batchYield: number,
  rows: { name: string; amount: number; unit: string }[],
): Promise<{ ok: boolean; error?: string }> {
  const db = await requireAdmin();
  const clean = rows
    .map((r, i) => ({
      product_id: productId,
      name: String(r.name).trim().slice(0, 60),
      amount: Math.max(0, Number(r.amount) || 0),
      unit: ["g", "ml", "each"].includes(r.unit) ? r.unit : "g",
      sort: i,
    }))
    .filter((r) => r.name && r.amount > 0)
    .slice(0, 40);
  const { error: e1 } = await db.from("products").update({ batch_yield: Math.max(1, Math.floor(batchYield) || 1) }).eq("id", productId);
  if (e1) return { ok: false, error: "Couldn't save. Did you run 004-new-look.sql in Supabase?" };
  await db.from("recipe_ingredients").delete().eq("product_id", productId);
  if (clean.length) {
    const { error } = await db.from("recipe_ingredients").insert(clean);
    if (error) return { ok: false, error: "Couldn't save the ingredients. Try again." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/menu");
  return { ok: true };
}
