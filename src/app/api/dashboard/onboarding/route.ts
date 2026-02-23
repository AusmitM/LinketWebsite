import { NextResponse } from "next/server";

import type { OnboardingChecklist, OnboardingChecklistItem } from "@/lib/analytics-service";
import { createServerSupabase } from "@/lib/supabase/server";

const SHARE_TEST_EVENT_IDS = [
  "vcard_download_success",
  "share_contact_success",
] as const;

type UserProfileRow = {
  id: string;
  handle: string | null;
  is_active: boolean | null;
};

type ProfileLinkRow = {
  profile_id: string | null;
};

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("does not exist");
}

function buildOnboardingChecklist(input: {
  profiles: UserProfileRow[];
  linksByProfile: Map<string, number>;
  hasPublishedLeadForm: boolean;
  shareTestCount: number;
}): OnboardingChecklist {
  const { profiles, linksByProfile, hasPublishedLeadForm, shareTestCount } = input;
  const activeProfile = profiles.find((profile) => profile.is_active) ?? profiles[0];

  const hasCustomHandle = profiles.some((profile) => {
    const handle = profile.handle?.trim().toLowerCase() ?? "";
    if (!handle) return false;
    return !/^user-[0-9a-f]{8}$/i.test(handle);
  });
  const hasPublishedProfile = profiles.some((profile) => profile.is_active);
  const activeLinkCount = activeProfile
    ? linksByProfile.get(activeProfile.id) ?? 0
    : 0;
  const hasThreeLinks = activeLinkCount >= 3;
  const hasShareTest = shareTestCount > 0;

  const items: OnboardingChecklistItem[] = [
    {
      id: "publish_profile",
      label: "Publish profile",
      completed: hasPublishedProfile,
      detail: hasPublishedProfile
        ? "An active profile is live."
        : "Activate one public profile.",
    },
    {
      id: "publish_lead_form",
      label: "Publish lead form",
      completed: hasPublishedLeadForm,
      detail: hasPublishedLeadForm
        ? "Lead form is published."
        : "Publish your lead form to collect contacts.",
    },
    {
      id: "set_handle",
      label: "Set handle",
      completed: hasCustomHandle,
      detail: hasCustomHandle
        ? "Public handle is configured."
        : "Choose a custom public handle.",
    },
    {
      id: "add_three_links",
      label: "Add 3 links",
      completed: hasThreeLinks,
      detail: hasThreeLinks
        ? `${activeLinkCount} links are live.`
        : `${activeLinkCount}/3 links published.`,
    },
    {
      id: "test_share",
      label: "Test share",
      completed: hasShareTest,
      detail: hasShareTest
        ? "Share or vCard flow has been tested."
        : "Use Share Contact or Save Contact once.",
    },
  ];

  const completedCount = items.reduce(
    (total, item) => (item.completed ? total + 1 : total),
    0
  );

  return {
    items,
    completedCount,
    totalCount: items.length,
    progress: items.length > 0 ? completedCount / items.length : 0,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabase();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (auth.user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [profilesResult, linksResult, leadFormsResult, shareEventsResult] =
      await Promise.all([
        supabase
          .from("user_profiles")
          .select("id,handle,is_active")
          .eq("user_id", userId),
        supabase
          .from("profile_links")
          .select("profile_id")
          .eq("user_id", userId)
          .eq("is_active", true),
        supabase
          .from("lead_forms")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "published")
          .limit(1),
        supabase
          .from("conversion_events")
          .select("event_id")
          .eq("user_id", userId)
          .in("event_id", [...SHARE_TEST_EVENT_IDS]),
      ]);

    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }
    if (linksResult.error) {
      throw new Error(linksResult.error.message);
    }
    if (leadFormsResult.error) {
      throw new Error(leadFormsResult.error.message);
    }
    if (shareEventsResult.error && !isMissingRelationError(shareEventsResult.error)) {
      throw new Error(shareEventsResult.error.message);
    }

    const linksByProfile = new Map<string, number>();
    for (const row of (linksResult.data ?? []) as ProfileLinkRow[]) {
      if (!row.profile_id) continue;
      linksByProfile.set(
        row.profile_id,
        (linksByProfile.get(row.profile_id) ?? 0) + 1
      );
    }

    const checklist = buildOnboardingChecklist({
      profiles: (profilesResult.data ?? []) as UserProfileRow[],
      linksByProfile,
      hasPublishedLeadForm: Boolean(leadFormsResult.data?.length),
      shareTestCount: shareEventsResult.data?.length ?? 0,
    });

    return NextResponse.json(checklist, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load checklist.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
