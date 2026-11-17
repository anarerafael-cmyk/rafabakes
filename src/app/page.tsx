import { getCurrentDrop } from "@/lib/drops";
import { getPublicReviews } from "@/lib/reviews";
import { formatDropTime } from "@/lib/types";
import Reviews from "./Reviews";
import Shop from "./Shop";

export const dynamic = "force-dynamic"; // always show live stock

export default async function Home({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const [result, rv, sp] = await Promise.all([getCurrentDrop(), getPublicReviews(), searchParams]);
  const prefill = /^RAFA-\d{1,8}$/i.test(sp.review ?? "") ? sp.review!.toUpperCase() : undefined;
  const reviews = <Reviews reviews={rv.reviews} average={rv.average} total={rv.total} prefillCode={prefill} />;

  if (result.state !== "open") {
    return (
      <main className="page">
        <header className="topbar">
          <img className="logo" src="/logo.png" alt="rafa sourdough & cookies" />
          <a className="pill-link" href="#reviews">Reviews</a>
        </header>
        <section className="panel hero">
          <h1>{result.state === "upcoming" ? "next drop soon" : "no drop right now"}</h1>
          <p style={{ fontSize: 14 }}>
            {result.state === "upcoming"
              ? `Orders open ${formatDropTime(result.drop.opensAt)}.`
              : "Check back soon for the next bake."}
          </p>
        </section>
        {reviews}
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
      reviews={reviews}
    />
  );
}
