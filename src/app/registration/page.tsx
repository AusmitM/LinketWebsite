"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function RegistrationPage() {
  return (
    <Suspense fallback={<RegistrationFallback />}>
      <RegistrationContent />
    </Suspense>
  );
}

function RegistrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [isAuthed, setIsAuthed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [error, setError] = useState("");
  const [showBackup, setShowBackup] = useState(false);
  const [claimCode, setClaimCode] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!active) return;
        setIsAuthed(response.ok);
      } catch {
        if (!active) return;
        setIsAuthed(false);
      } finally {
        if (active) setCheckedAuth(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function claim(primary = true) {
    setError("");

    const body: { token: string; claim_code?: string } = { token };
    if (!primary) {
      body.claim_code = claimCode.trim();
      if (!body.claim_code) {
        setError("Enter the backup claim code before submitting.");
        return;
      }
    }

    try {
      const response = await fetch("/api/linkets/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        router.push(`/dashboard?claimed=${token}`);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (payload?.hint === "try_backup_code") {
        setShowBackup(true);
        setError("We could not match your purchase email. Enter the backup claim code from your box.");
        return;
      }

      setError(typeof payload?.error === "string" ? payload.error : "Unable to claim this Linket.");
    } catch {
      setError("Unable to claim this Linket right now. Try again shortly.");
    }
  }

  const nextQuery = encodeURIComponent(`/registration?token=${token}`);
  const signupHref = `/auth?view=signup&next=${nextQuery}`;
  const loginHref = `/auth?view=signin&next=${nextQuery}`;

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Set up your Linket</h1>
      <p className="text-sm text-gray-600">
        Device token: <code>{token || "unknown"}</code>
      </p>

      {checkedAuth && !isAuthed && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <a className="rounded border p-4 hover:bg-gray-50" href={signupHref}>
            <h2 className="mb-1 font-medium">1) Start a new account</h2>
            <p className="text-sm text-gray-600">Create an account, then we will attach this Linket.</p>
          </a>
          <a className="rounded border p-4 hover:bg-gray-50" href={loginHref}>
            <h2 className="mb-1 font-medium">2) Add to an existing account</h2>
            <p className="text-sm text-gray-600">Sign in, then claim without a code.</p>
          </a>
        </section>
      )}

      <section className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Claim this Linket</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => claim(true)} className="rounded bg-black px-4 py-2 text-white">
            Claim with my account (no code)
          </button>
          <button onClick={() => setShowBackup((value) => !value)} className="rounded border px-4 py-2">
            {showBackup ? "Hide backup" : "Use backup claim code"}
          </button>
        </div>

        {showBackup && (
          <div className="pt-2">
            <label className="mb-1 block text-sm">Backup claim code (scratch-off in the box)</label>
            <input
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value)}
              className="mb-3 w-full rounded border p-2"
              placeholder="XXXX-XXXX-XXXX"
            />
            <button onClick={() => claim(false)} className="rounded bg-black px-4 py-2 text-white">
              Claim with backup code
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}

function RegistrationFallback() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
      <div className="h-32 animate-pulse rounded border border-dashed" />
    </main>
  );
}
