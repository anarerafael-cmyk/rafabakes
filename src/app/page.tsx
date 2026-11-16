import { getCurrentDrop } from "@/lib/drops";
import { formatDropTime } from "@/lib/types";
import Shop from "./Shop";

export const dynamic = "force-dynamic"; // always show live stock

export default async function Home() {
  const result = await getCurrentDrop();

  if (result.state !== "open") {
    return (
      <main className="page">
        <header className="topbar">
          <img className="logo" src="/logo.png" alt="rafa sourdough & cookies" />
        </header>
        <section className="panel hero">
          <h1>{result.state === "upcoming" ? "next drop soon" : "no drop right now"}</h1>
          <p style={{ fontSize: 14 }}>
            {result.state === "upcoming"
              ? `Orders open ${formatDropTime(result.drop.opensAt)}.`
              : "Check back soon for the next bake."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <Shop
      drop={result.drop}
      preview={result.preview}
      venmo={process.env.NEXT_PUBLIC_VENMO_HANDLE || ""}
      zelle={process.env.NEXT_PUBLIC_ZELLE_CONTACT || ""}
      cardEnabled={Boolean(process.env.STRIPE_SECRET_KEY)}
    />
  );
}
