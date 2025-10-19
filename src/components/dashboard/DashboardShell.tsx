"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onResize = () => setOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const items = [
    { href: "#profile", label: "Profile" },
    { href: "#avatar", label: "Avatar" },
    { href: "#links", label: "Links" },
    { href: "#vcard", label: "vCard" },
    { href: "#settings", label: "Settings" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr_18rem]">
        <aside className="rounded-xl border bg-white p-3 shadow-sm lg:sticky lg:top-20 lg:h-fit" aria-label="Sidebar">
          <button
            className="mb-2 inline-flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            Sections
            <span aria-hidden>{open ? "–" : "+"}</span>
          </button>
          <nav className={cn("space-y-1", !open && "hidden lg:block")}>
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              >
                {it.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 space-y-6">{children}</section>

        <aside className="hidden rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm lg:block" aria-label="Tips">
          <h3 className="mb-2 text-base font-semibold text-slate-900">Tips</h3>
          <ul className="list-disc space-y-2 pl-4">
            <li>Profile affects your public header and theme.</li>
            <li>Links show on your public page in the same order.</li>
            <li>Use vCard to export a contact for offline sharing.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

