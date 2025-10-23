"use client";

import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/system/toaster";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DEFAULT_NEXT = "/dashboard/linkets";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = useMemo(() => {
    if (!nextParam) return DEFAULT_NEXT;
    const trimmed = nextParam.trim();
    if (!trimmed) return DEFAULT_NEXT;
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }, [nextParam]);
  const oauthError = searchParams.get("error");
  const oauthMessage = searchParams.get("message");
  const view = searchParams.get("view") ?? "signin";
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSignIn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      setPending(true);
      setError(null);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          throw error;
        }

        if (data.session) {
          const response = await fetch("/auth/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
          });
          if (!response.ok) {
            throw new Error("Could not finalize session. Please try again.");
          }
        }

        toast({
          title: "Welcome back!",
          description: "Your dashboard is ready to manage Linkets.",
          variant: "success",
        });

        const destination = next || DEFAULT_NEXT;
        router.replace(destination);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to sign in. Please try again.";
        setError(message);
      } finally {
        setPending(false);
      }
    },
    [email, password, supabase, router, next]
  );

  const handleOAuth = useCallback(
    async (provider: "facebook" | "google") => {
      setPending(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(
            next
          )}`,
        },
      });

      if (error) {
        setError(error.message);
        setPending(false);
      }
    },
    [supabase, next]
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-neutral-500">
          Sign in with your credentials to access your dashboard.
        </p>
      </header>

      {(error || oauthError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error ?? oauthMessage ?? "Authentication failed. Please try again."}
        </div>
      )}

      <form
        onSubmit={handlePasswordSignIn}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white/60 p-6 shadow-sm backdrop-blur"
      >
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-neutral-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-neutral-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Enter your password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in with email"}
        </button>

        <div className="flex justify-end">
          <Link
            href={`/reset-password${
              next ? `?next=${encodeURIComponent(next)}` : ""
            }`}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </form>

      <div className="space-y-3">
        <div className="relative text-center text-xs uppercase tracking-wide text-neutral-400">
          <span className="relative z-10 bg-white px-2">or continue with</span>
          <div className="absolute inset-y-0 left-0 right-0 flex items-center">
            <div className="h-px w-full bg-neutral-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Google</span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("facebook")}
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Facebook</span>
          </button>
        </div>
      </div>

      {view === "signup" ? (
        <p className="text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link
            href={`/auth?next=${encodeURIComponent(next)}&view=signin`}
            className="font-semibold text-blue-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      ) : (
        <p className="text-center text-sm text-neutral-500">
          New to Linket?{" "}
          <Link
            href={`/registration?next=${encodeURIComponent(next)}`}
            className="font-semibold text-blue-600 hover:underline"
          >
            Create an account
          </Link>
        </p>
      )}
    </div>
  );
}
