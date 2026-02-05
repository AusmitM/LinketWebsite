"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/system/toaster";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${SITE_URL}/reset-password`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setSent(true);
      toast({
        title: "Check your email",
        description: "We sent you a password reset link.",
        variant: "success",
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to send reset email. Please try again.";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#fff7ed] px-4">
        <Card className="max-w-md border border-foreground/10 bg-card/80 shadow-xl backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              We&apos;ve sent a password reset link to <strong>{email}</strong>.
              Click the link in the email to reset your password.
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or{" "}
              <button
                onClick={() => setSent(false)}
                className="font-medium text-blue-600 hover:underline"
              >
                try again
              </button>
              .
            </p>
            <Button asChild className="w-full rounded-full" variant="outline">
              <Link href="/auth?view=signin">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#fff7ed] px-4 py-16">
      <Card className="w-full max-w-md border border-foreground/10 bg-card/80 shadow-xl backdrop-blur">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-foreground">
            Reset your password
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

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
                  onChange={(e) => setEmail(e.target.value)}
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
                "Send reset link"
              )}
            </Button>

            <div className="text-center">
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
