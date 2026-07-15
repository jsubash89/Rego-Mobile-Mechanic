"use client";
import { useState } from "react";
export default function LoginForm() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError("");
    const secret = new FormData(event.currentTarget).get("secret");
    try { const response = await fetch("/operator/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret }) });
      if (response.ok) { location.replace("/operator/requests"); return; }
      setError(response.status === 429 ? "Too many attempts. Try again later." : "Sign-in failed.");
    } catch { setError("Sign-in is unavailable."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 text-slate-950 shadow-xl">
    <p className="text-sm font-bold text-emerald-700">REGO PILOT OPERATIONS</p><h1 className="mt-2 text-2xl font-black">Operator sign in</h1>
    <p className="mt-2 text-sm text-slate-600">Authorized pilot operators only.</p>
    <label className="mt-6 block font-semibold" htmlFor="operator-secret">Operator secret</label>
    <input id="operator-secret" name="secret" type="password" required autoComplete="current-password" className="mt-2 w-full rounded-lg border p-3" />
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    <button disabled={busy} className="mt-5 w-full rounded-lg bg-emerald-700 p-3 font-bold text-white disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
  </form>;
}
