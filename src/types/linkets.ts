import type {
  HardwareTagRecord,
  TagAssignmentRecord,
  UserProfileRecord,
} from "@/types/db";

export type LinketProOfferStatus = {
  claimable: boolean;
  claimedAt: string | null;
  claimedByUserId: string | null;
};

export type TagAssignmentDetail = {
  assignment: TagAssignmentRecord;
  tag: HardwareTagRecord;
  profile: Pick<UserProfileRecord, "id" | "name" | "handle" | "is_active"> | null;
  proOffer: LinketProOfferStatus;
};

export type ClaimLinketProOfferResult = {
  status: "claimed" | "already_claimed_by_you" | "already_claimed_by_other";
  tagId: string;
  claimedAt: string;
  entitlementEndsAt: string | null;
};
