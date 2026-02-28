import "server-only";

import Stripe from "stripe";

const MIN_FUTURE_WINDOW_SECONDS = 60;

function toUnixFromIso(value: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function buildComplimentaryPauseMetadata(args: {
  existing: Stripe.Metadata;
  startsAt: string | null;
  endsAt: string | null;
  source: string;
}) {
  const metadata: Record<string, string> = {
    ...args.existing,
    complimentary_no_charge: "true",
    complimentary_pause_source: args.source,
  };
  if (args.startsAt) {
    metadata.complimentary_window_starts_at = args.startsAt;
  }
  if (args.endsAt) {
    metadata.complimentary_window_ends_at = args.endsAt;
  }
  return metadata;
}

export function pickManageableSubscriptionId(subscriptions: Stripe.Subscription[]) {
  const priority: Stripe.Subscription.Status[] = [
    "trialing",
    "active",
    "past_due",
    "unpaid",
    "paused",
  ];
  for (const status of priority) {
    const match = subscriptions.find((subscription) => subscription.status === status);
    if (match) return match.id;
  }
  return null;
}

export async function ensureNoChargeDuringComplimentary(args: {
  stripe: Stripe;
  subscriptionId: string;
  complimentaryStartsAt: string | null;
  complimentaryEndsAt: string | null;
  source: "linket_claim_api" | "billing_subscribe" | "stripe_webhook";
}) {
  const endsAtUnix = toUnixFromIso(args.complimentaryEndsAt);
  if (!endsAtUnix) return false;

  const nowUnix = Math.floor(Date.now() / 1000);
  if (endsAtUnix <= nowUnix + MIN_FUTURE_WINDOW_SECONDS) {
    return false;
  }

  const subscription = await args.stripe.subscriptions.retrieve(args.subscriptionId);
  if (
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired"
  ) {
    return false;
  }

  const existingPause = subscription.pause_collection;
  const existingResumeAt = existingPause?.resumes_at ?? null;
  const targetResumesAt =
    existingResumeAt && existingResumeAt > endsAtUnix
      ? existingResumeAt
      : endsAtUnix;

  const alreadyProtected =
    existingPause?.behavior === "void" &&
    typeof existingResumeAt === "number" &&
    existingResumeAt >= endsAtUnix;
  if (alreadyProtected) return false;

  await args.stripe.subscriptions.update(
    subscription.id,
    {
      pause_collection: {
        behavior: "void",
        resumes_at: targetResumesAt,
      },
      proration_behavior: "none",
      metadata: buildComplimentaryPauseMetadata({
        existing: subscription.metadata,
        startsAt: args.complimentaryStartsAt,
        endsAt: args.complimentaryEndsAt,
        source: args.source,
      }),
    },
    {
      idempotencyKey: `complimentary-no-charge:${subscription.id}:${targetResumesAt}`,
    }
  );

  return true;
}

