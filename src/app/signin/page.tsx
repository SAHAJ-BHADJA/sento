"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, fullName }),
        });
        if (!res.ok) {
          setError((await res.json()).error ?? "sign up failed");
          return;
        }
      }
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) setError("Invalid email or password");
      else router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">{mode === "signin" ? "Sign in to Sento" : "Create your account"}</h1>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        {mode === "signup" && (
          <input
            className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        )}
        <input
          className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10"
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button
        className="mt-3 text-sm text-slate-400 hover:text-slate-200"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
