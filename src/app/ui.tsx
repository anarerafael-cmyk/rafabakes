// Small shared pieces of the look.

export function Ridge() {
  return (
    <svg className="ridge" aria-hidden="true" viewBox="0 0 390 44" preserveAspectRatio="none">
      <circle cx="276" cy="26" r="14" fill="#F6C860" />
      <path d="M0 44 L0 34 L40 16 L66 28 L112 4 L150 26 L180 14 L222 36 L254 22 L282 32 L322 8 L358 28 L390 18 L390 44 Z" fill="#2A1A12" />
      <path d="M112 4 L100 13 L108 11 L116 15 L124 10 Z M322 8 L311 16 L319 15 L327 18 L334 14 Z" fill="#FFF6EA" />
    </svg>
  );
}

export function Peaks() {
  return (
    <svg aria-hidden="true" width="22" height="14" viewBox="0 0 22 14">
      <path d="M0 14 L7 3 L11 8 L15 1 L22 14 Z" fill="currentColor" />
    </svg>
  );
}

export function BackArrow() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function Ribbon({ words }: { words: string[] }) {
  // The words are written out twice so the loop scrolls without a seam.
  const run = (copy: string) =>
    words.flatMap((w, i) => [
      <span key={`${copy}w${i}`}>{w}</span>,
      <span key={`${copy}s${i}`} className="star">✺</span>,
    ]);
  return (
    <div className="ribbon" aria-hidden="true">
      <div className="ribbon-track">
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" role="img" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}
