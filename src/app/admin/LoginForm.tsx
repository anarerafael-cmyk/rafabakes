"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card summary" style={{ gap: 12 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700 }}>baker sign in</h1>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="cta" style={{ fontSize: 18, minHeight: 52 }} disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
    </form>
  );
}
