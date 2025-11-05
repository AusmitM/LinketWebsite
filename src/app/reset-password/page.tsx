"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Check, Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/system/toaster";
import { cn } from "@/lib/utils";

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[a-zA-Z]/, "Include a letter")
  .regex(/\d/, "Include a number");

const schema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords must match",
        path: ["confirmPassword"],
      });
    }
  });

type ResetErrors = Partial<Record<"password" | "confirmPassword", string>>;

type ResetState = "checking" | "ready" | "expired" | "complete";

type FormState = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ResetState>("checking");
  const [formValues, setFormValues] = useState<FormState>({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<ResetErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setStatus("expired");
      } else {
        setStatus("ready");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const allChecks = useMemo(
    () => [
      { label: "At least 8 characters", pass: formValues.password.length >= 8 },
      {
        label: "Contains a letter",
        pass: /[a-zA-Z]/.test(formValues.password),
      },
      { label: "Contains a number", pass: /\d/.test(formValues.password) },
    ],
    [formValues.password]
  );

  function setField(field: keyof FormState, value: string) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }

  function assignErrors(issues: z.ZodIssue[]) {
    const next: ResetErrors = {};
    for (const issue of issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !next[field as keyof ResetErrors]) {
        next[field as keyof ResetErrors] = issue.message;
      }
    }
    setErrors(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const parsed = schema.safeParse(formValues);
      if (!parsed.success) {
        assignErrors(parsed.error.issues);
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) {
        setErrors({ password: friendlyResetError(error.message) });
        return;
      }
      toast({
        title: "Password updated",
        description: "Sign in with your new password.",
        variant: "success",
      });
      setStatus("complete");
      setTimeout(() => router.replace("/auth?reset=success"), 800);
    } finally {
      setLoading(false);
    }
  }

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Verifying reset link...
        </div>
      </main>
    );
  }

  if (status === "expired") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Password reset link expired</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Your reset link is no longer valid or has already been used.</p>
            <Button asChild className="w-full rounded-full">
              <Link href="/auth?view=forgot">Request a new reset link</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (status === "complete") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Password updated</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Your password has been updated. Redirecting you to the sign in
              page...
            </p>
            <Button asChild className="w-full rounded-full">
              <Link href="/auth">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-16">
      <Card className="w-full max-w-md border border-foreground/10 bg-card/80 shadow-xl backdrop-blur">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-foreground">
            Create a new password
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a strong password that you have not used on Linket before.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                New password
              </Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formValues.password}
                  onChange={(event) => setField("password", event.target.value)}
                  autoComplete="new-password"
                  placeholder="********"
                  className="pl-9 pr-10"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-2 flex items-center rounded-full px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-rose-600">
                  {errors.password}
                </p>
              )}
              <ul className="grid gap-1 text-xs text-muted-foreground">
                {allChecks.map((check) => (
                  <li key={check.label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded-full border",
                        check.pass
                          ? "border-emerald-400 text-emerald-500"
                          : "border-muted-foreground/40 text-muted-foreground"
                      )}
                      aria-hidden
                    >
                      {check.pass ? <Check className="h-3 w-3" /> : ""}
                    </span>
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-foreground"
              >
                Confirm password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={formValues.confirmPassword}
                  onChange={(event) =>
                    setField("confirmPassword", event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  className="pr-10"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  aria-label={
                    showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  className="absolute inset-y-0 right-2 flex items-center rounded-full px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm((prev) => !prev)}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs font-medium text-rose-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Updating...
                </span>
              ) : (
                "Save new password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function friendlyResetError(message: string) {
  if (message.toLowerCase().includes("password should be at least")) {
    return "Choose a stronger password (minimum 8 characters with letters and numbers).";
  }
  return message;
}
