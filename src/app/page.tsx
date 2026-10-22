"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Nav } from "@/components/Nav";

type AppStatus =
  | "DISCOVERED" | "MATCHED" | "TAILORING" | "READY" | "QUEUED"
  | "SUBMITTING" | "SUBMITTED" | "NEEDS_YOU" | "RESPONDED" | "REJECTED"
  | "SKIPPED" | "FAILED";

interface AppRow {
  id: string;
  status: AppStatus;
  matchScore: number;
  needsReason: string | null;
  submittedAt: string | null;
  job: { title: string; location: string | null; url: string; company: { name: string } };
}

const STATUS_COLOR: Record<AppStatus, string> = {
  DISCOVERED: "bg-slate-600/40 text-slate-200",
  MATCHED: "bg-sky-600/40 text-sky-100",
  TAILORING: "bg-indigo-600/40 text-indigo-100",
  READY: "bg-teal-600/40 text-teal-100",
  QUEUED: "bg-violet-600/40 text-violet-100",
  SUBMITTING: "bg-amber-600/40 text-amber-100",
  SUBMITTED: "bg-good/30 text-emerald-100",
  NEEDS_YOU: "bg-warn/30 text-amber-100",
  RESPONDED: "bg-good/30 text-emerald-100",
  REJECTED: "bg-bad/30 text-rose-100",
  SKIPPED: "bg-slate-700/50 text-slate-300",
  FAILED: "bg-bad/30 text-rose-100",
};

export default function Dashboard() {
  const { status } = useSession();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function load() {
    const res = await fetch("/api/applications");
    if (res.ok) setApps((await res.json()).applications);
  }

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status]);

  const stats = useMemo(() => {
    const by: Partial<Record<AppStatus, number>> = {};
    for (const a of apps) by[a.status] = (by[a.status] ?? 0) + 1;
    return by;
  }, [apps]);

  const needsYou = apps.filter((a) => a.status === "NEEDS_YOU");

  async function runCycle() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/engine/run", { method: "POST" });
      const data = await res.json();
      setMsg(res.ok ? `Discovered ${data.discovered} jobs, matched ${data.matched}.` : data.error);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: string) {
    await fetch(`/api/applications/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  if (status === "loading") return <p className="text-slate-400">Loading…</p>;

  if (status !== "authenticated") {
    return (
      <div className="card max-w-md">
        <h1 className="text-2xl font-semibold">Sento</h1>
        <p className="mt-2 text-slate-400">
          Apply on autopilot. Sign in to see your matches and application queue.
        </p>
        <button className="btn-primary mt-4" onClick={() => signIn()}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <Nav />
      <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-slate-300">Overview</h1>
        <button className="btn-primary" disabled={busy} onClick={runCycle}>
          {busy ? "Running…" : "Run now"}
        </button>
      </header>

      {msg && <div className="card text-sm text-slate-300">{msg}</div>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Matched" value={stats.MATCHED ?? 0} />
        <Stat label="Submitted" value={stats.SUBMITTED ?? 0} />
        <Stat label="Needs you" value={needsYou.length} highlight={needsYou.length > 0} />
        <Stat label="Total" value={apps.length} />
      </section>

      {needsYou.length > 0 && (
        <section className="card border-warn/40">
          <h2 className="mb-3 text-lg font-medium text-amber-100">Needs you</h2>
          <ul className="space-y-3">
            {needsYou.map((a) => (
              <li key={a.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <a className="font-medium text-accent" href={a.job.url} target="_blank" rel="noreferrer">
                      {a.job.title}
                    </a>
                    <div className="text-sm text-slate-400">{a.job.company.name}</div>
                    <p className="mt-1 text-sm text-amber-200/90">{a.needsReason}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button className="btn-primary" onClick={() => act(a.id, "mark_submitted")}>
                      I submitted it
                    </button>
                    <button className="btn-ghost" onClick={() => act(a.id, "retry")}>
                      Retry auto
                    </button>
                    <button className="btn-ghost" onClick={() => act(a.id, "skip")}>
                      Skip
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 text-lg font-medium">Applications</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-slate-400">
            No applications yet. Add companies to monitor, then press <b>Run now</b>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Role</th>
                  <th>Company</th>
                  <th>Match</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-white/5">
                    <td className="py-2">
                      <a className="text-accent" href={a.job.url} target="_blank" rel="noreferrer">
                        {a.job.title}
                      </a>
                    </td>
                    <td className="text-slate-300">{a.job.company.name}</td>
                    <td className="text-slate-300">{a.matchScore}%</td>
                    <td>
                      <span className={`badge ${STATUS_COLOR[a.status]}`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card ${highlight ? "border-warn/50" : ""}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
