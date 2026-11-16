// Date helpers pinned to Denver time, so "Thu 8 PM" means 8 PM in Colorado
// no matter where the server runs.
const TZ = "America/Denver";

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** "2026-11-23T19:00" typed in Denver time -> ISO timestamp. */
export function denverLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const wanted = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = new Date(wanted);
  for (let i = 0; i < 2; i++) {
    const q = parts(guess);
    const shown = Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi);
    guess = new Date(guess.getTime() + (wanted - shown));
  }
  return guess.toISOString();
}

/** ISO timestamp -> "2026-11-23T19:00" in Denver time, for datetime-local inputs. */
export function isoToDenverLocal(iso: string): string {
  const q = parts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${q.y}-${pad(q.mo)}-${pad(q.d)}T${pad(q.h)}:${pad(q.mi)}`;
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
