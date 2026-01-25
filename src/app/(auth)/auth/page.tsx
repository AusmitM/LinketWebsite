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
    <div className="auth-shell min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="auth-backdrop pointer-events-none absolute inset-0 -z-10">
          <div className="auth-orb auth-orb-primary" />
          <div className="auth-orb auth-orb-ring" />
          <div className="auth-grid" />
        </div>

        <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-16">
          <section className="auth-panel w-full max-w-md space-y-6 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <span className="font-display text-sm font-semibold text-foreground">
                Linket
              </span>
              <span className="auth-pill">Secure access</span>
            </div>

            <header className="space-y-2">
              <h1 className="text-3xl font-display font-semibold tracking-tight sm:text-4xl">
                {isSignUp ? "Create your account" : "Welcome back"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isSignUp
                  ? "Sign up to start managing your Linkets."
                  : "Sign in with your credentials to access your dashboard."}
              </p>
            </header>

            {(error || oauthError) && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error ?? oauthMessage ?? "Authentication failed. Please try again."}
              </div>
            )}

            <form
              onSubmit={isSignUp ? handlePasswordSignUp : handlePasswordSignIn}
              className="space-y-4"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  onChange={(event) => setPassword(event.target.value)}
                  className="auth-input"
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
                className="auth-button-primary"
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
                    className="text-sm font-medium text-foreground/80 transition hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </form>

            <div className="space-y-3">
              <div className="auth-divider text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <span>or continue with</span>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  disabled={pending}
                  className="auth-button-secondary"
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
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={`/auth?next=${encodeURIComponent(next)}&view=signin`}
                  className="font-semibold text-foreground transition hover:text-foreground/80"
                >
                  Sign in
                </Link>
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                New to Linket?{" "}
                <Link
                  href={`/auth?next=${encodeURIComponent(next)}&view=signup`}
                  className="font-semibold text-foreground transition hover:text-foreground/80"
                >
                  Create an account
                </Link>
              </p>
            )}
          </section>

          <aside className="auth-hero hidden flex-1 flex-col gap-6 rounded-3xl border border-border/60 bg-card/40 p-8 text-left shadow-[0_30px_80px_-60px_rgba(15,23,42,0.6)] backdrop-blur lg:flex">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Linket dashboard
              </p>
              <h2 className="text-3xl font-display font-semibold leading-tight text-foreground">
                A premium workspace for your links, profiles, and brand.
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage your public profile, build lead forms, and share contact
                info with a cohesive visual system tailored to your theme.
              </p>
            </div>
            <div className="auth-feature-grid">
              <div className="auth-feature-card">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Unified theme
                </p>
                <p className="text-sm text-foreground">
                  Every surface, border, and highlight aligns with your brand.
                </p>
              </div>
              <div className="auth-feature-card">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Smart links
                </p>
                <p className="text-sm text-foreground">
                  Track clicks and keep your most important links in focus.
                </p>
              </div>
              <div className="auth-feature-card">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Lead capture
                </p>
                <p className="text-sm text-foreground">
                  Collect contacts with branded forms and a smooth mobile view.
                </p>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
