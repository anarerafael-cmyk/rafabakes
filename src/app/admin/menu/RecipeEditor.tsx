"use client";

import { useState, useTransition } from "react";
import { saveRecipe } from "./actions";

type Unit = "g" | "ml" | "each";
type Row = { key: number; name: string; amount: string; unit: Unit };
const UNITS: Unit[] = ["g", "ml", "each"];

function fmt(q: number, unit: Unit) {
  if (unit === "each") return String(Math.ceil(q));
  if (unit === "g" && q >= 1000) return `${Math.round(q / 100) / 10} kg`;
  return `${Math.round(q)} ${unit}`;
}

export default function RecipeEditor({ productId, productName, batchYield, initial }: {
  productId: string;
  productName: string;
  batchYield: number;
  initial: { name: string; amount: number; unit: Unit }[];
}) {
  const [makes, setMakes] = useState(String(batchYield));
  const [rows, setRows] = useState<Row[]>(
    initial.length
      ? initial.map((r, i) => ({ key: i, name: r.name, amount: String(r.amount), unit: r.unit }))
      : [{ key: 0, name: "", amount: "", unit: "g" }],
  );
  const [nextKey, setNextKey] = useState(initial.length + 1);
  const [tryCount, setTryCount] = useState(12);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (key: number, patch: Partial<Row>) => {
    setSaved(null);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const yieldN = Math.max(1, parseInt(makes, 10) || 1);
  const batches = tryCount / yieldN;
  const filled = rows.filter((r) => r.name.trim() && Number(r.amount) > 0);

  function save() {
    start(async () => {
      const res = await saveRecipe(productId, yieldN, filled.map((r) => ({ name: r.name.trim(), amount: Number(r.amount), unit: r.unit })));
      setSaved(res.ok ? "Recipe saved." : res.error ?? "Couldn't save. Try again.");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 14, fontWeight: 800 }}>
        <label htmlFor={`makes-${productId}`}>One batch makes</label>
        <input id={`makes-${productId}`} type="number" min={1} inputMode="numeric" className="input" style={{ width: 76, height: 44 }}
               value={makes} onChange={(e) => { setSaved(null); setMakes(e.target.value); }} />
        <span>of these</span>
      </div>
      <p className="allergens" style={{ margin: 0 }}>For bread that&apos;s usually 1 loaf. For cookies sold 6 to a box, a 24-cookie batch makes 4.</p>

      <div className="recipe-grid eyebrow" aria-hidden="true">
        <span>ingredient</span><span>amount</span><span>unit</span><span />
      </div>
      {rows.map((r, idx) => (
        <div className="recipe-grid" key={r.key}>
          <input className="input" aria-label={`Ingredient ${idx + 1}`} placeholder="bread flour" value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
          <input className="input" aria-label={`Amount for ingredient ${idx + 1}`} type="number" min={0} step="any" inputMode="decimal" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} />
          <button type="button" className="unit-btn" aria-label={`Unit ${r.unit}, tap to change`}
                  onClick={() => update(r.key, { unit: UNITS[(UNITS.indexOf(r.unit) + 1) % UNITS.length] })}>{r.unit}</button>
          <button type="button" className="x-btn" aria-label={`Remove ${r.name || `ingredient ${idx + 1}`}`}
                  onClick={() => { setSaved(null); setRows((rs) => rs.filter((x) => x.key !== r.key)); }}>×</button>
        </div>
      ))}
      <button type="button" className="add-row" onClick={() => { setRows((rs) => [...rs, { key: nextKey, name: "", amount: "", unit: "g" }]); setNextKey((k) => k + 1); }}>
        + add ingredient
      </button>

      {filled.length > 0 && (
        <div className="dark" style={{ borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span className="display" style={{ fontWeight: 600, fontSize: 17 }}>try it: if you sell</span>
            <div className="stepper" style={{ background: "var(--paper)", color: "var(--ink)" }}>
              <button type="button" aria-label="Fewer" onClick={() => setTryCount((n) => Math.max(1, n - 1))}>−</button>
              <span>{tryCount}</span>
              <button type="button" className="plus" aria-label="More" onClick={() => setTryCount((n) => Math.min(99, n + 1))}>+</button>
            </div>
          </div>
          <span style={{ fontSize: 13, color: "#e9d8c2" }}>{tryCount} {productName} = {Math.round(batches * 100) / 100} {batches === 1 ? "batch" : "batches"}. You&apos;ll need:</span>
          {filled.map((r) => (
            <div key={r.key} className="line" style={{ borderBottom: "1px dashed #5e4a3c", paddingBottom: 6 }}>
              <span>{r.name}</span><b>{fmt(Number(r.amount) * batches, r.unit)}</b>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="mini" style={{ minHeight: 48 }} onClick={save} disabled={pending}>{pending ? "Saving…" : "Save recipe"}</button>
      {saved && <span role="status" style={{ fontSize: 14, fontWeight: 800 }}>{saved}</span>}
    </div>
  );
}
