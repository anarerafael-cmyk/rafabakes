import Link from "next/link";
import { BackArrow, Ridge } from "../ui";
import { logout } from "./actions";

/** Dark header with the mountain ridge, used on every baker page. */
export default function AdminHeader({ title, back, children }: { title: string; back?: string; children?: React.ReactNode }) {
  return (
    <div className="admin-top">
      <div style={{ paddingTop: 10 }}><Ridge /></div>
      <header className="dark admin-head">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {back && <Link href={back} className="back light" aria-label="Back to this week"><BackArrow /></Link>}
            <div>
              <span className="eyebrow">baker view</span>
              <h1>{title}</h1>
            </div>
          </div>
          {!back && <form action={logout}><button className="mini light">Sign out</button></form>}
        </div>
        {children}
      </header>
    </div>
  );
}
