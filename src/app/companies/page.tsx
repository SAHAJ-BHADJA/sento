"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Nav } from "@/components/Nav";

type AtsType = "GREENHOUSE" | "LEVER" | "ASHBY";

interface CompanyRow {
  id: string;
  name: string;
  atsType: string;
  atsIdentifier: string;
  careersUrl: string | null;
  active: boolean;
  lastPolledAt: string | null;
  _count: { jobs: number };
}

const ATS_HINT: Record<AtsType, string> = {
  GREENHOUSE: "board token, e.g. the slug in boards.greenhouse.io/<token>",
  LEVER: "company slug, e.g. the name in jobs.lever.co/<slug>",
  ASHBY: "board name, e.g. the name in jobs.ashbyhq.com/<name>",
};

export default function CompaniesPage() {
  const { status } = useSession();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [name, setName] = useState("");
  const [atsType, setAtsType] = useState<AtsType>("GREENHOUSE");
  const [atsIdentifier, setAtsIdentifier] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/companies");
    if (res.ok) setCompanies((await res.json()).companies);
  }

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, atsType, atsIdentifier }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Added ${name} — found ${data.discovered} open roles.`);
        setName("");
        setAtsIdentifier("");
        await load();
      } else {
        setMsg(data.error ?? "Could not add company.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok && "repoll" in body) {
      const data = await res.json();
      setMsg(`Re-polled — found ${data.discovered} new roles.`);
    }
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    await load();
  }

  if (status === "loading") return <p className="text-slate-400">Loading…</p>;
  if (status !== "authenticated") {
    return (
      <div className="card max-w-md">
        <p className="text-slate-300">Please sign in to manage companies.</p>
        <button className="btn-primary mt-3" onClick={() => signIn()}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <Nav />
      <section className="card">
        <h2 className="mb-3 text-lg font-medium">Add a company to monitor</h2>
        <form className="grid gap-3 sm:grid-cols-[1fr_160px_1fr_auto] sm:items-end" onSubmit={add}>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Company name</span>
            <input
              className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">ATS</span>
            <select
              className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10"
              value={atsType}
              onChange={(e) => setAtsType(e.target.value as AtsType)}
            >
              <option value="GREENHOUSE">Greenhouse</option>
              <option value="LEVER">Lever</option>
              <option value="ASHBY">Ashby</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Identifier</span>
            <input
              className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10"
              value={atsIdentifier}
              onChange={(e) => setAtsIdentifier(e.target.value)}
              required
            />
          </label>
          <button className="btn-primary h-10" disabled={busy}>
            {busy ? "…" : "Add"}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">{ATS_HINT[atsType]}</p>
        {msg && <p className="mt-2 text-sm text-slate-300">{msg}</p>}
      </section>

      <section className="card mt-6">
        <h2 className="mb-3 text-lg font-medium">Monitored companies ({companies.length})</h2>
        {companies.length === 0 ? (
          <p className="text-sm text-slate-400">None yet. Add one above.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {companies.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">
                    {c.name}{" "}
                    <span className="badge bg-white/10 text-slate-300">{c.atsType.toLowerCase()}</span>
                    {!c.active && <span className="badge ml-2 bg-slate-700/60 text-slate-300">paused</span>}
                  </div>
                  <div className="text-sm text-slate-400">
                    <code>{c.atsIdentifier}</code> · {c._count.jobs} jobs
                    {c.lastPolledAt ? ` · last polled ${new Date(c.lastPolledAt).toLocaleString()}` : " · never polled"}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="btn-ghost" onClick={() => patch(c.id, { repoll: true })}>
                    Re-poll
                  </button>
                  <button className="btn-ghost" onClick={() => patch(c.id, { active: !c.active })}>
                    {c.active ? "Pause" : "Resume"}
                  </button>
                  <button className="btn-ghost text-rose-300" onClick={() => remove(c.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
