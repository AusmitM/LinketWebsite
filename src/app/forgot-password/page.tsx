"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/system/toaster";
import { friendlyAuthError } from "@/lib/auth-errors";
import { getSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState(() => searchParams.get("email")?.trim() ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${getSiteOrigin()}/reset-password`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setEmail(normalizedEmail);
      setSent(true);
      toast({
        title: "Check your email",
        description:
          "If that address matches an account, we sent a password reset link.",
        variant: "success",
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to send reset email. Please try again.";
      const description = friendlyAuthError(message);
      setError(description);
      toast({
        title: "Couldn't send reset email",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#fff7ed] px-4 py-16">
      <Card className="w-full max-w-md border border-foreground/10 bg-card/80 shadow-xl backdrop-blur">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-foreground">
            Reset your password
          </CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send a secure password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {sent ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                If <span className="font-medium">{email}</span> matches an account,
                a reset link is on the way. Open that link to choose a new password.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email address
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (sent) {
                      setSent(false);
                    }
                  }}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending...
                </span>
              ) : (
                sent ? "Send another reset link" : "Send reset link"
              )}
            </Button>

            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-xs text-muted-foreground">
                Check your inbox and spam folder. The link will open a secure page
                where you can choose a new password.
              </p>
              <Link
                href="/auth?view=signin"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
