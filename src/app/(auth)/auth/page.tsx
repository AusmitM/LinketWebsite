"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/system/toaster";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const DEFAULT_NEXT = "/dashboard/overview";

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
  const siteUrl =
    SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveRedirect = useCallback(
    async (session: unknown) => {
      try {
        const response = await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "SIGNED_IN", session }),
        });
        if (!response.ok) return next || DEFAULT_NEXT;
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload.redirectTo === "string") {
          return payload.redirectTo;
        }
      } catch {
        return next || DEFAULT_NEXT;
      }
      return next || DEFAULT_NEXT;
    },
    [next]
  );

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        const destination = await resolveRedirect(data.session);
        router.replace(destination);
        router.refresh();
      }
    };

    syncSession();

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;
      const destination = await resolveRedirect(session);
      router.replace(destination);
      router.refresh();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase, router, resolveRedirect]);

  const handlePasswordSignUp = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      setPending(true);
      setError(null);

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(
              next
            )}`,
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          // User is immediately signed in
          const destination = await resolveRedirect(data.session);

          toast({
            title: "Account created!",
            description: "Welcome to Linket.",
            variant: "success",
          });

          router.replace(destination);
          router.refresh();
        } else {
          // Email confirmation required
          toast({
            title: "Account created!",
            description: "Please sign in with your new credentials.",
            variant: "success",
          });

          // Redirect to sign-in page
          router.push(`/auth?next=${encodeURIComponent(next)}&view=signin`);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to create account. Please try again.";
        setError(message);
      } finally {
        setPending(false);
      }
    },
    [email, password, supabase, router, next, resolveRedirect]
  );

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

        const destination = data.session
          ? await resolveRedirect(data.session)
          : next || DEFAULT_NEXT;

        toast({
          title: "Welcome back!",
          description: "Your dashboard is ready to manage Linkets.",
          variant: "success",
        });

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
    [email, password, supabase, router, next, resolveRedirect]
  );

  const handleOAuth = useCallback(
    async (provider: "google") => {
      setPending(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(
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

  const isSignUp = view === "signup";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-neutral-500">
          {isSignUp
            ? "Sign up to start managing your Linkets."
            : "Sign in with your credentials to access your dashboard."}
        </p>
      </header>

      {(error || oauthError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error ?? oauthMessage ?? "Authentication failed. Please try again."}
        </div>
      )}

      <form
        onSubmit={isSignUp ? handlePasswordSignUp : handlePasswordSignIn}
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
            autoComplete={isSignUp ? "new-password" : "current-password"}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder={
              isSignUp
                ? "Create a password (6+ characters)"
                : "Enter your password"
            }
            required
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? isSignUp
              ? "Creating account..."
              : "Signing in..."
            : isSignUp
            ? "Create account"
            : "Sign in with email"}
        </button>

        {!isSignUp && (
          <div className="flex justify-end">
            <Link
              href={`/forgot-password${
                next ? `?next=${encodeURIComponent(next)}` : ""
              }`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        )}
      </form>

      <div className="space-y-3">
        <div className="relative text-center text-xs uppercase tracking-wide text-neutral-400">
          <span className="relative z-10 bg-white px-2">or continue with</span>
          <div className="absolute inset-y-0 left-0 right-0 flex items-center">
            <div className="h-px w-full bg-neutral-200" />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
      </div>

      {isSignUp ? (
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
            href={`/auth?next=${encodeURIComponent(next)}&view=signup`}
            className="font-semibold text-blue-600 hover:underline"
          >
            Create an account
          </Link>
        </p>
      )}
    </div>
  );
}
