"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Nav } from "@/components/Nav";

const COMMON_QUESTIONS: { slug: string; label: string }[] = [
  { slug: "why_this_company", label: "Why do you want to work here? (generic version Sento can adapt)" },
  { slug: "why_leaving", label: "Why are you looking to leave your current role?" },
  { slug: "salary_expectations", label: "Salary expectations" },
  { slug: "notice_period", label: "Notice period / availability" },
  { slug: "pronouns", label: "Pronouns" },
];

type ArrayField = "titles" | "skills" | "locationsPreferred";

interface ProfileState {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  websiteUrl: string;
  githubUrl: string;
  workAuthorization: string;
  requiresSponsorship: boolean;
  titles: string;
  skills: string;
  locationsPreferred: string;
  remoteOnly: boolean;
  minSalary: string;
  maxJobAgeHours: string;
  maxExperienceYears: string;
  allowedLevels: string[];
  allowedEmploymentTypes: string[];
  strictLocations: boolean;
  remoteOk: boolean;
  requirePositiveSponsorship: boolean;
  excludeKeywords: string;
  baseResumeText: string;
}

const LEVELS: { value: string; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead+" },
];

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];

const EMPTY: ProfileState = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedinUrl: "",
  websiteUrl: "",
  githubUrl: "",
  workAuthorization: "",
  requiresSponsorship: false,
  titles: "",
  skills: "",
  locationsPreferred: "",
  remoteOnly: false,
  minSalary: "",
  maxJobAgeHours: "",
  maxExperienceYears: "",
  allowedLevels: [],
  allowedEmploymentTypes: [],
  strictLocations: false,
  remoteOk: true,
  requirePositiveSponsorship: false,
  excludeKeywords: "",
  baseResumeText: "",
};

function toList(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const { status } = useSession();
  const [p, setP] = useState<ProfileState>(EMPTY);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const { profile, user } = await res.json();
      if (profile) {
        setP({
          fullName: profile.fullName ?? "",
          email: profile.email ?? user?.email ?? "",
          phone: profile.phone ?? "",
          location: profile.location ?? "",
          linkedinUrl: profile.linkedinUrl ?? "",
          websiteUrl: profile.websiteUrl ?? "",
          githubUrl: profile.githubUrl ?? "",
          workAuthorization: profile.workAuthorization ?? "",
          requiresSponsorship: Boolean(profile.requiresSponsorship),
          titles: (profile.titles ?? []).join(", "),
          skills: (profile.skills ?? []).join(", "),
          locationsPreferred: (profile.locationsPreferred ?? []).join(", "),
          remoteOnly: Boolean(profile.remoteOnly),
          minSalary: profile.minSalary ? String(profile.minSalary) : "",
          maxJobAgeHours: profile.maxJobAgeHours ? String(profile.maxJobAgeHours) : "",
          maxExperienceYears:
            profile.maxExperienceYears !== null && profile.maxExperienceYears !== undefined
              ? String(profile.maxExperienceYears)
              : "",
          allowedLevels: profile.allowedLevels ?? [],
          allowedEmploymentTypes: profile.allowedEmploymentTypes ?? [],
          strictLocations: Boolean(profile.strictLocations),
          remoteOk: profile.remoteOk === undefined ? true : Boolean(profile.remoteOk),
          requirePositiveSponsorship: Boolean(profile.requirePositiveSponsorship),
          excludeKeywords: (profile.excludeKeywords ?? []).join(", "),
          baseResumeText: profile.baseResumeText ?? "",
        });
        setAnswers((profile.customAnswers as Record<string, string>) ?? {});
      } else if (user) {
        setP((s) => ({ ...s, email: user.email, fullName: user.name ?? "" }));
      }
    })();
  }, [status]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved("");
    try {
      const body = {
        ...p,
        titles: toList(p.titles),
        skills: toList(p.skills),
        locationsPreferred: toList(p.locationsPreferred),
        minSalary: p.minSalary ? Number.parseInt(p.minSalary, 10) : null,
        maxJobAgeHours: p.maxJobAgeHours ? Number.parseInt(p.maxJobAgeHours, 10) : null,
        maxExperienceYears: p.maxExperienceYears !== "" ? Number.parseInt(p.maxExperienceYears, 10) : null,
        excludeKeywords: toList(p.excludeKeywords),
        customAnswers: Object.fromEntries(
          Object.entries(answers).filter(([, v]) => v && v.trim()),
        ),
      };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaved(res.ok ? "Saved." : "Save failed — check required fields.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <p className="text-slate-400">Loading…</p>;
  if (status !== "authenticated") {
    return (
      <div className="card max-w-md">
        <p className="text-slate-300">Please sign in to edit your profile.</p>
        <button className="btn-primary mt-3" onClick={() => signIn()}>
          Sign in
        </button>
      </div>
    );
  }

  const set = (k: keyof ProfileState, v: string | boolean) => setP((s) => ({ ...s, [k]: v }));
  const arrayHint = (label: string) => `${label} (comma or newline separated)`;
  const toggleArr = (k: "allowedLevels" | "allowedEmploymentTypes", v: string) =>
    setP((s) => {
      const cur = s[k];
      return { ...s, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  return (
    <div>
      <Nav />
      <form className="space-y-6" onSubmit={save}>
        <section className="card space-y-3">
          <h2 className="text-lg font-medium">Identity &amp; contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={p.fullName} onChange={(v) => set("fullName", v)} required />
            <Field label="Email" value={p.email} onChange={(v) => set("email", v)} type="email" required />
            <Field label="Phone" value={p.phone} onChange={(v) => set("phone", v)} />
            <Field label="Location" value={p.location} onChange={(v) => set("location", v)} />
            <Field label="LinkedIn URL" value={p.linkedinUrl} onChange={(v) => set("linkedinUrl", v)} />
            <Field label="GitHub URL" value={p.githubUrl} onChange={(v) => set("githubUrl", v)} />
            <Field label="Website / portfolio" value={p.websiteUrl} onChange={(v) => set("websiteUrl", v)} />
            <Field
              label="Work authorization"
              value={p.workAuthorization}
              onChange={(v) => set("workAuthorization", v)}
              placeholder="e.g. US Citizen"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.requiresSponsorship}
              onChange={(e) => set("requiresSponsorship", e.target.checked)}
            />
            I require visa sponsorship
          </label>
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-medium">What you&apos;re looking for</h2>
          <Field label={arrayHint("Target titles")} value={p.titles} onChange={(v) => set("titles", v)} placeholder="Software Engineer, Backend Engineer" />
          <Field label={arrayHint("Skills")} value={p.skills} onChange={(v) => set("skills", v)} placeholder="typescript, react, postgres, aws" />
          <Field label={arrayHint("Preferred locations")} value={p.locationsPreferred} onChange={(v) => set("locationsPreferred", v)} placeholder="Remote, New York NY" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum salary (USD)" value={p.minSalary} onChange={(v) => set("minSalary", v.replace(/[^0-9]/g, ""))} />
            <label className="flex items-center gap-2 pt-7 text-sm">
              <input type="checkbox" checked={p.remoteOnly} onChange={(e) => set("remoteOnly", e.target.checked)} />
              Remote only
            </label>
          </div>
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-medium">Hard filters</h2>
            <p className="text-sm text-slate-400">
              Applied before scoring. Blank = no filter. These remove jobs that don&apos;t fit before Sento ever ranks or applies.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Posted within (hours)"
              value={p.maxJobAgeHours}
              onChange={(v) => set("maxJobAgeHours", v.replace(/[^0-9]/g, ""))}
              placeholder="24"
            />
            <Field
              label="Max required experience (years)"
              value={p.maxExperienceYears}
              onChange={(v) => set("maxExperienceYears", v.replace(/[^0-9]/g, ""))}
              placeholder="2"
            />
          </div>

          <div>
            <span className="mb-1 block text-sm text-slate-300">Allowed levels</span>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  type="button"
                  key={l.value}
                  onClick={() => toggleArr("allowedLevels", l.value)}
                  className={`badge ${p.allowedLevels.includes(l.value) ? "bg-accent text-white" : "bg-white/10 text-slate-300"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm text-slate-300">Employment types</span>
            <div className="flex flex-wrap gap-2">
              {EMPLOYMENT_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => toggleArr("allowedEmploymentTypes", t.value)}
                  className={`badge ${p.allowedEmploymentTypes.includes(t.value) ? "bg-accent text-white" : "bg-white/10 text-slate-300"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Field
            label={arrayHint("Exclude jobs mentioning")}
            value={p.excludeKeywords}
            onChange={(v) => set("excludeKeywords", v)}
            placeholder="clearance, senior, staff, on-site only"
          />

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.strictLocations} onChange={(e) => set("strictLocations", e.target.checked)} />
              Strict location — only jobs in my preferred locations (or remote)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.remoteOk} onChange={(e) => set("remoteOk", e.target.checked)} />
              Remote roles always satisfy location
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={p.requirePositiveSponsorship}
                onChange={(e) => set("requirePositiveSponsorship", e.target.checked)}
              />
              Only roles that explicitly offer visa sponsorship (requires &quot;I require sponsorship&quot; above)
            </label>
          </div>
        </section>

        <section className="card space-y-2">
          <h2 className="text-lg font-medium">Base résumé</h2>
          <p className="text-sm text-slate-400">
            Paste your full résumé as plain text. Sento only reorders and re-emphasizes what&apos;s here — it never invents experience.
          </p>
          <textarea
            className="h-64 w-full rounded-lg bg-white/5 p-3 font-mono text-sm outline-none ring-1 ring-white/10"
            value={p.baseResumeText}
            onChange={(e) => set("baseResumeText", e.target.value)}
            placeholder="NAME&#10;Summary…&#10;&#10;EXPERIENCE&#10;…"
          />
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-medium">Common application answers</h2>
          <p className="text-sm text-slate-400">
            Optional. Used to answer recurring open-ended questions; Sento adapts them per role.
          </p>
          {COMMON_QUESTIONS.map((q) => (
            <div key={q.slug}>
              <label className="mb-1 block text-sm text-slate-300">{q.label}</label>
              <textarea
                className="h-20 w-full rounded-lg bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10"
                value={answers[q.slug] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.slug]: e.target.value }))}
              />
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
          {saved && <span className="text-sm text-slate-300">{saved}</span>}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-300">{label}</span>
      <input
        className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10"
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
