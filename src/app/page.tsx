import { getCurrentDrop } from "@/lib/drops";
import { getPublicReviews } from "@/lib/reviews";
import { SITE } from "@/lib/site";
import { formatDropTime } from "@/lib/types";
import Reviews from "./Reviews";
import Shop from "./Shop";
import { Peaks, Ribbon, Ridge } from "./ui";

export const dynamic = "force-dynamic"; // always show live stock

export default async function Home({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const [result, rv, sp] = await Promise.all([getCurrentDrop(), getPublicReviews(), searchParams]);
  const orderToken = /^[0-9a-f-]{36}$/i.test(sp.review ?? "") ? sp.review : undefined;
  const reviews = <Reviews reviews={rv.reviews} average={rv.average} total={rv.total} orderToken={orderToken} />;

  if (result.state !== "open") {
    return (
      <main className="page">
        <header className="topbar">
          <img className="logo" src="/logo.png" alt="rafa sourdough & cookies" />
          <a className="pill-link" href="#reviews">Reviews</a>
        </header>
        <section className="hero">
          <img className="hero-photo" src={SITE.heroPhoto} alt="Sliced sourdough loaf with an airy crumb" />
          <div className="hero-body">
            <div className="hero-top">
              <h1>{result.state === "upcoming" ? "next drop soon" : "no drop right now"}</h1>
              <span className="chip"><span className="dot" />closed</span>
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              {result.state === "upcoming"
                ? `Orders open ${formatDropTime(result.drop.opensAt)}.`
                : "Check back soon for the next bake."}
            </p>
          </div>
        </section>
        <Ribbon words={SITE.ribbon} />
        <div style={{ marginTop: 18 }}>
          <Ridge />
          <section className="dark about">
            {SITE.aboutPhoto && <img className="about-photo" src={SITE.aboutPhoto} alt="Rafael" />}
            <div>
              <h2>hi, i&apos;m <span>rafael</span></h2>
              <p>{SITE.aboutText}</p>
            </div>
          </section>
        </div>
        {reviews}
        <p className="made-in"><Peaks />baked with love in colorado</p>
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
