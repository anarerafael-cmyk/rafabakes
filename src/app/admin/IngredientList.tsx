"use client";

import { useEffect, useMemo, useState } from "react";

export type BakeNeeds = {
  name: string;
  sold: number;
  batchYield: number;
  ingredients: { name: string; amount: number; unit: "g" | "ml" | "each" }[]; // per batch
};

function fmt(q: number, unit: string, units: "g" | "lb") {
  if (unit === "each") return String(Math.ceil(q));
  if (unit === "ml") return units === "g" ? `${Math.round(q)} ml` : `${Math.round((q / 14.79) * 10) / 10} tbsp`;
  if (units === "g") return q >= 1000 ? `${Math.round(q / 100) / 10} kg` : `${Math.round(q)} g`;
  const oz = q / 28.35;
  if (oz < 16) return `${Math.round(oz * 10) / 10} oz`;
  const lb = Math.floor(oz / 16);
  const rest = Math.round(oz - lb * 16);
  return `${lb} lb${rest ? ` ${rest} oz` : ""}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function IngredientList({ dropId, bakes }: { dropId: string; bakes: BakeNeeds[] }) {
  const [mode, setMode] = useState<"bake" | "all">("bake");
  const [units, setUnits] = useState<"g" | "lb">("g");
  const [got, setGot] = useState<Record<string, boolean>>({});
  const storeKey = `rafa-got-${dropId}`;

  // Remember check marks on this phone for this drop.
  useEffect(() => {
    try { setGot(JSON.parse(localStorage.getItem(storeKey) || "{}")); } catch { /* storage unavailable */ }
  }, [storeKey]);
  const toggle = (k: string) => setGot((g) => {
    const next = { ...g, [k]: !g[k] };
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });

  const groups = useMemo(() => {
    const active = bakes.filter((b) => b.sold > 0 && b.ingredients.length);
    if (mode === "bake") {
      return active.map((b) => {
        const batches = b.sold / b.batchYield;
        return {
          title: b.name,
          sub: b.batchYield === 1 ? `${b.sold} to bake` : `${b.sold} sold · ${round2(batches)} batches`,
          rows: b.ingredients.map((i) => ({ key: `${b.name}|${i.name}`, name: i.name, amount: fmt(i.amount * batches, i.unit, units), from: "" })),
        };
      });
    }
    const totals = new Map<string, { name: string; unit: string; qty: number; from: string[] }>();
    for (const b of active) {
      const batches = b.sold / b.batchYield;
      for (const i of b.ingredients) {
        const k = `${i.name.trim().toLowerCase()}|${i.unit}`;
        const t = totals.get(k) ?? { name: i.name, unit: i.unit, qty: 0, from: [] };
        t.qty += i.amount * batches;
        t.from.push(b.name);
        totals.set(k, t);
      }
    }
    const rows = [...totals.values()]
      .sort((a, b) => b.qty - a.qty)
      .map((t) => ({ key: `all|${t.name}|${t.unit}`, name: t.name, amount: fmt(t.qty, t.unit, units), from: t.from.length > 1 ? `for ${t.from.join(" + ")}` : "" }));
    return [{ title: "", sub: "", rows }];
  }, [bakes, mode, units]);

  const all = groups.flatMap((g) => g.rows);
  const missing = bakes.filter((b) => b.sold > 0 && !b.ingredients.length).map((b) => b.name);

  return (
    <section className="card">
      <div className="ing-head">
        <h2 style={{ fontSize: 24 }}>ingredients for this drop</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
          <div className="toggle" role="group" aria-label="Group ingredients">
            <button aria-pressed={mode === "bake"} onClick={() => setMode("bake")}>by bake</button>
            <button aria-pressed={mode === "all"} onClick={() => setMode("all")}>all together</button>
          </div>
          <div className="toggle" role="group" aria-label="Units">
            <button aria-pressed={units === "g"} onClick={() => setUnits("g")}>grams</button>
            <button aria-pressed={units === "lb"} onClick={() => setUnits("lb")}>lb / oz</button>
          </div>
        </div>
        {all.length > 0 && <span style={{ fontSize: 13, fontWeight: 700 }}>{all.filter((r) => got[r.key]).length} of {all.length} checked off</span>}
      </div>
      <div style={{ padding: "4px 10px 12px" }}>
        {all.length === 0 && (
          <p style={{ margin: "12px 8px", fontSize: 14 }}>
            {bakes.some((b) => b.sold > 0) ? "Add recipes in Menu & recipes to see what to buy." : "No orders yet. This fills in as orders come in."}
          </p>
        )}
        {groups.map((g) => (
          <div className="ing-group" key={g.title || "all"}>
            {g.title && (
              <div className="ing-title">
                <b className="display" style={{ fontSize: 18 }}>{g.title}</b>
                <span className="allergens">{g.sub}</span>
              </div>
            )}
            {g.rows.map((r) => (
              <button key={r.key} className="ing-row" aria-pressed={Boolean(got[r.key])} onClick={() => toggle(r.key)}>
                <span className="ing-box">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
                <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span className="ing-name">{r.name}</span>
                  {r.from && <span className="allergens" style={{ fontWeight: 600 }}>{r.from}</span>}
                </span>
                <span className="ing-amt">{r.amount}</span>
              </button>
            ))}
          </div>
        ))}
        {missing.length > 0 && all.length > 0 && (
          <p className="allergens" style={{ margin: "10px 8px 0" }}>No recipe yet for {missing.join(", ")}.</p>
        )}
      </div>
    </section>
  );
}
