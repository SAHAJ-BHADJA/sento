"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/companies", label: "Companies" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  return (
    <nav className="mb-6 flex items-center justify-between border-b border-white/10 pb-3">
      <div className="flex items-center gap-1">
        <span className="mr-3 text-lg font-semibold">Sento</span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              pathname === l.href ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {session?.user?.email && (
          <span className="hidden text-sm text-slate-400 sm:inline">{session.user.email}</span>
        )}
        <button className="btn-ghost" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
