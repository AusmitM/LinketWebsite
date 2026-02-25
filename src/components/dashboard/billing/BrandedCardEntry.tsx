"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  loadStripe,
  type Stripe as StripeClient,
  type StripeCardElementChangeEvent,
  type StripeCardElementOptions,
} from "@stripe/stripe-js";
import { ShieldCheck } from "lucide-react";

import { toast } from "@/components/system/toaster";
import { useThemeOptional } from "@/components/theme/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBrowserCsrfToken, CSRF_HEADER_NAME } from "@/lib/csrf";
import { cn } from "@/lib/utils";

type SetupIntentResponse = {
  clientSecret?: string;
  error?: string;
};

function buildJsonHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const csrfToken = getBrowserCsrfToken();
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }
  return headers;
}

const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const hasStripePublishableKey = Boolean(stripePublishableKey);

function readCssVariable(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name);
  const normalized = value.trim();
  return normalized || fallback;
}

function buildCardElementOptions(): StripeCardElementOptions {
  const text = readCssVariable(
    "--card-foreground",
    readCssVariable("--foreground", "#0f172a")
  );
  const muted = readCssVariable(
    "--muted-foreground",
    readCssVariable("--card-foreground", "#64748b")
  );
  const danger = readCssVariable("--danger", "#dc2626");

  return {
    hidePostalCode: true,
    style: {
      base: {
        color: text,
        fontFamily:
          "Nunito, Quicksand, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: "16px",
        fontWeight: "600",
        lineHeight: "1.4",
        iconColor: muted,
        "::placeholder": {
          color: muted,
        },
      },
      invalid: {
        color: danger,
        iconColor: danger,
      },
    },
  };
}

export default function BrandedCardEntry() {
  const { theme } = useThemeOptional();
  const isHookEmOrAggieTheme =
    theme === "burnt-orange" || theme === "maroon";
  const [intentStarted, setIntentStarted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeClient, setStripeClient] = useState<StripeClient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [cardOptions, setCardOptions] = useState<StripeCardElementOptions>(() =>
    buildCardElementOptions()
  );

  useEffect(() => {
    setCardOptions(buildCardElementOptions());
  }, [theme]);

  useEffect(() => {
    if (!intentStarted) return;

    let active = true;
    const controller = new AbortController();

    async function createSetupIntent() {
      if (!hasStripePublishableKey) {
        if (!active) return;
        setError("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setStripeClient(null);
      setClientSecret(null);

      try {
        const loadedStripe = await loadStripe(stripePublishableKey);
        if (!loadedStripe) {
          throw new Error(
            "Failed to load Stripe.js. Allow js.stripe.com and retry."
          );
        }
        if (!active) return;
        setStripeClient(loadedStripe);

        const response = await fetch("/api/billing/setup-intent", {
          method: "POST",
          headers: buildJsonHeaders(),
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | SetupIntentResponse
          | null;
        if (!response.ok || !payload?.clientSecret) {
          throw new Error(payload?.error || "Unable to initialize card entry.");
        }
        if (!active) return;
        setClientSecret(payload.clientSecret);
      } catch (setupError) {
        if (!active) return;
        const message =
          setupError instanceof Error
            ? setupError.message
            : "Unable to initialize card entry.";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void createSetupIntent();
    return () => {
      active = false;
      controller.abort();
    };
  }, [intentStarted, reloadNonce]);

  if (!hasStripePublishableKey) {
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900">
        Billing form unavailable: missing{" "}
        <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
      </p>
    );
  }

  if (!intentStarted) {
    return (
      <div className="space-y-3 rounded-2xl border bg-card/40 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Add a card only when you are ready. The secure Stripe field initializes on demand.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "rounded-full !bg-none !bg-background !border-border hover:!bg-accent",
            isHookEmOrAggieTheme ? "!text-white" : "!text-[var(--foreground)]"
          )}
          onClick={() => {
            setIntentStarted(true);
            setReloadNonce((value) => value + 1);
          }}
        >
          Add card
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
        Loading secure card entry...
      </p>
    );
  }

  if (error || !clientSecret || !stripeClient) {
    return (
      <div className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <p>{error || "Unable to initialize secure card entry."}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => setReloadNonce((value) => value + 1)}
        >
          Retry card form
        </Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripeClient}>
      <BrandedCardEntryForm
        clientSecret={clientSecret}
        cardOptions={cardOptions}
        onRetry={() => setReloadNonce((value) => value + 1)}
      />
    </Elements>
  );
}

function BrandedCardEntryForm({
  clientSecret,
  cardOptions,
  onRetry,
}: {
  clientSecret: string;
  cardOptions: StripeCardElementOptions;
  onRetry: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [slowLoadWarning, setSlowLoadWarning] = useState(false);

  const canSubmit = useMemo(
    () =>
      Boolean(
        stripe &&
          elements &&
          !submitting &&
          cardReady &&
          cardComplete &&
          !cardError
      ),
    [stripe, elements, submitting, cardReady, cardComplete, cardError]
  );

  useEffect(() => {
    setSlowLoadWarning(false);
    const timer = window.setTimeout(() => {
      if (!cardReady) {
        setSlowLoadWarning(true);
      }
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [cardReady]);

  function handleCardChange(event: StripeCardElementChangeEvent) {
    setCardComplete(event.complete);
    setCardError(event.error?.message ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Secure card field is not ready yet.");
      }

      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (result.error) {
        throw new Error(result.error.message || "Unable to save payment method.");
      }

      const paymentMethodId =
        typeof result.setupIntent?.payment_method === "string"
          ? result.setupIntent.payment_method
          : result.setupIntent?.payment_method?.id ?? null;

      if (!paymentMethodId) {
        throw new Error("No payment method returned by Stripe.");
      }

      const response = await fetch("/api/billing/payment-method/default", {
        method: "POST",
        headers: buildJsonHeaders(),
        body: JSON.stringify({ paymentMethodId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to set default payment method.");
      }

      toast({
        title: "Payment method saved",
        description: "Your card was added securely and set as default.",
        variant: "success",
      });
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to save payment method.";
      setFormError(message);
      toast({
        title: "Card save failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border bg-card/40 p-4 shadow-sm"
    >
      <div className="billing-card-entry-header flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/60 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Secure card entry
        </div>
        <Badge
          variant="outline"
          className="billing-card-entry-header-badge rounded-full text-[11px]"
        >
          Stripe encrypted
        </Badge>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Card details
        </p>
        <div
          className={cn(
            "rounded-xl border bg-card px-3 py-3 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--card)_88%,transparent)]",
            cardError ? "border-destructive/60" : "border-border"
          )}
        >
          <CardElement
            options={cardOptions}
            onReady={() => {
              setCardReady(true);
              setSlowLoadWarning(false);
            }}
            onChange={handleCardChange}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Supports major credit and debit cards.
        </p>
      </div>

      {cardError ? <p className="text-xs text-destructive">{cardError}</p> : null}
      {slowLoadWarning ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-2 text-xs text-amber-900">
          Secure field is taking longer than usual. Check network/ad blockers,
          then retry if needed.
        </div>
      ) : null}
      {formError ? (
        <p className="text-xs text-destructive">{formError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Card details are handled by Stripe Elements. Linket servers never see
          raw card numbers, CVC, or full PAN data.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          variant={canSubmit ? "default" : "outline"}
          className={cn(
            "rounded-full",
            !canSubmit &&
              "disabled:!opacity-100 disabled:!bg-muted disabled:!text-foreground disabled:!border-border"
          )}
          disabled={!canSubmit}
        >
          {submitting
            ? "Saving..."
            : cardReady
              ? "Save card"
              : "Loading secure field..."}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={onRetry}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
