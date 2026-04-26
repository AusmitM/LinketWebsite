import "server-only";

import { randomBytes } from "crypto";

import { normalizeUserEmail } from "@/lib/auth-admin-users";
import {
  grantLinketEntitlementToUser,
  type LinketEntitlementUser,
} from "@/lib/linket-entitlements";
import { getActiveProfileForUser } from "@/lib/profile-service";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

const TRANSFER_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type AssignmentLookupRow = {
  id: string;
  tag_id: string;
  user_id: string;
  nickname: string | null;
  profile_id: string | null;
  hardware_tags:
    | {
        chip_uid: string;
        claim_code: string | null;
      }
    | null;
};

type LinketTransferRequestRow = {
  id: string;
  tag_id: string;
  user_id: string;
  recipient_email: string;
  transfer_token: string;
  status: "pending" | "accepted" | "canceled" | "expired";
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  canceled_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type LinketTransferMetadata = Record<string, unknown>;

export type LinketTransferPreview = {
  id: string;
  assignmentId: string | null;
  chipUid: string | null;
  claimCode: string | null;
  nickname: string | null;
  recipientEmail: string;
  status: "pending" | "accepted" | "canceled" | "expired";
  expiresAt: string;
  createdAt: string;
  isSender: boolean;
  canAccept: boolean;
  alreadyAcceptedByCurrentUser: boolean;
};

function buildExpiryIso() {
  return new Date(Date.now() + TRANSFER_WINDOW_DAYS * MS_PER_DAY).toISOString();
}

function isExpired(value: string) {
  const expiryMs = new Date(value).getTime();
  return Number.isFinite(expiryMs) && expiryMs <= Date.now();
}

function createTransferToken() {
  return randomBytes(24).toString("hex");
}

function mergeTransferMetadata(
  ...parts: Array<LinketTransferMetadata | null | undefined>
) {
  return parts.reduce<LinketTransferMetadata>(
    (accumulator, part) => (part ? { ...accumulator, ...part } : accumulator),
    {}
  );
}

async function fetchOwnedAssignmentById(assignmentId: string) {
  const { data, error } = await supabaseAdmin
    .from("tag_assignments")
    .select(
      `id,tag_id,user_id,nickname,profile_id,
      hardware_tags:hardware_tags(chip_uid,claim_code)`
    )
    .eq("id", assignmentId)
    .limit(1)
    .maybeSingle<AssignmentLookupRow | null>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function fetchTransferByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("linket_transfer_requests")
    .select(
      "id,tag_id,user_id,recipient_email,transfer_token,status,expires_at,accepted_at,accepted_by_user_id,canceled_at,metadata,created_at,updated_at"
    )
    .eq("transfer_token", token)
    .limit(1)
    .maybeSingle<LinketTransferRequestRow | null>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function fetchCurrentAssignmentByTagId(tagId: string) {
  const { data, error } = await supabaseAdmin
    .from("tag_assignments")
    .select(
      `id,tag_id,user_id,nickname,profile_id,
      hardware_tags:hardware_tags(chip_uid,claim_code)`
    )
    .eq("tag_id", tagId)
    .limit(1)
    .maybeSingle<AssignmentLookupRow | null>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function updateTransferStatus(args: {
  id: string;
  status: "accepted" | "canceled" | "expired";
  acceptedByUserId?: string | null;
  expectedCurrentStatus?: LinketTransferRequestRow["status"];
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status: args.status,
    updated_at: now,
  };

  if (args.status === "accepted") {
    payload.accepted_at = now;
    payload.accepted_by_user_id = args.acceptedByUserId ?? null;
  }

  if (args.status === "canceled") {
    payload.canceled_at = now;
  }

  if (args.metadata) {
    payload.metadata = args.metadata;
  }

  let query = supabaseAdmin
    .from("linket_transfer_requests")
    .update(payload)
    .eq("id", args.id);

  if (args.expectedCurrentStatus) {
    query = query.eq("status", args.expectedCurrentStatus);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelPendingTransfersForTag(
  tagId: string,
  canceledByUserId?: string | null,
  metadataPatch?: LinketTransferMetadata
) {
  if (!isSupabaseAdminAvailable) {
    throw new Error("Linkets service is not configured.");
  }

  const { data, error } = await supabaseAdmin
    .from("linket_transfer_requests")
    .select("id,metadata")
    .eq("tag_id", tagId)
    .eq("status", "pending")
    .returns<Array<Pick<LinketTransferRequestRow, "id" | "metadata">>>();

  if (error) {
    throw new Error(error.message);
  }

  await Promise.all(
    (data ?? []).map((transfer) =>
      updateTransferStatus({
        id: transfer.id,
        status: "canceled",
        expectedCurrentStatus: "pending",
        metadata: mergeTransferMetadata(
          transfer.metadata,
          canceledByUserId ? { canceled_by_user_id: canceledByUserId } : null,
          metadataPatch
        ),
      })
    )
  );
}

export async function createLinketTransferRequest(args: {
  assignmentId: string;
  senderUser: LinketEntitlementUser;
  recipientEmail: string;
}) {
  if (!isSupabaseAdminAvailable) {
    throw new Error("Linkets service is not configured.");
  }

  const recipientEmail = normalizeUserEmail(args.recipientEmail);
  if (!recipientEmail) {
    throw new Error("Enter a valid recipient email.");
  }

  if (recipientEmail === normalizeUserEmail(args.senderUser.email)) {
    throw new Error("Use a different email address for the recipient.");
  }

  const assignment = await fetchOwnedAssignmentById(args.assignmentId);
  if (!assignment || assignment.user_id !== args.senderUser.id) {
    throw new Error("Linket not found or not owned by the current user.");
  }

  await cancelPendingTransfersForTag(assignment.tag_id, args.senderUser.id, {
    canceled_reason: "replaced_by_new_transfer",
  });

  const transferToken = createTransferToken();
  const expiresAt = buildExpiryIso();
  const { data, error } = await supabaseAdmin
    .from("linket_transfer_requests")
    .insert({
      tag_id: assignment.tag_id,
      user_id: args.senderUser.id,
      recipient_email: recipientEmail,
      transfer_token: transferToken,
      status: "pending",
      expires_at: expiresAt,
      metadata: {
        assignment_id: assignment.id,
        nickname: assignment.nickname,
        chip_uid: assignment.hardware_tags?.chip_uid ?? null,
      },
    })
    .select(
      "id,tag_id,user_id,recipient_email,transfer_token,status,expires_at,accepted_at,accepted_by_user_id,canceled_at,metadata,created_at,updated_at"
    )
    .single<LinketTransferRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    transfer: data,
    assignment,
  };
}

export async function getLinketTransferPreview(args: {
  token: string;
  currentUser: LinketEntitlementUser;
  isAdmin?: boolean;
}) {
  if (!isSupabaseAdminAvailable) {
    throw new Error("Linkets service is not configured.");
  }

  const transfer = await fetchTransferByToken(args.token);
  if (!transfer) {
    return null;
  }

  if (transfer.status === "pending" && isExpired(transfer.expires_at)) {
    await updateTransferStatus({
      id: transfer.id,
      status: "expired",
      expectedCurrentStatus: "pending",
      metadata: {
        ...(transfer.metadata ?? {}),
        expired_at: new Date().toISOString(),
      },
    });
    transfer.status = "expired";
  }

  const assignment = await fetchCurrentAssignmentByTagId(transfer.tag_id);
  const currentUserEmail = normalizeUserEmail(args.currentUser.email);
  const isSender = transfer.user_id === args.currentUser.id;
  const emailMatches =
    currentUserEmail !== null &&
    currentUserEmail === normalizeUserEmail(transfer.recipient_email);
  const isRecipient = emailMatches;

  if (!isSender && !isRecipient && !args.isAdmin) {
    throw new Error("This transfer invite is not available to the current account.");
  }

  const canAccept =
    transfer.status === "pending" &&
    !isSender &&
    isRecipient &&
    assignment?.user_id === transfer.user_id;

  return {
    id: transfer.id,
    assignmentId: assignment?.id ?? null,
    chipUid:
      assignment?.hardware_tags?.chip_uid ??
      (typeof transfer.metadata?.chip_uid === "string"
        ? transfer.metadata.chip_uid
        : null),
    claimCode: assignment?.hardware_tags?.claim_code ?? null,
    nickname:
      assignment?.nickname ??
      (typeof transfer.metadata?.nickname === "string"
        ? transfer.metadata.nickname
        : null),
    recipientEmail: transfer.recipient_email,
    status: transfer.status,
    expiresAt: transfer.expires_at,
    createdAt: transfer.created_at,
    isSender,
    canAccept,
    alreadyAcceptedByCurrentUser: transfer.accepted_by_user_id === args.currentUser.id,
  } satisfies LinketTransferPreview;
}

export async function acceptLinketTransferRequest(args: {
  token: string;
  currentUser: LinketEntitlementUser;
}) {
  if (!isSupabaseAdminAvailable) {
    throw new Error("Linkets service is not configured.");
  }

  const transfer = await fetchTransferByToken(args.token);
  if (!transfer) {
    throw new Error("Transfer invite not found.");
  }

  if (transfer.status !== "pending") {
    throw new Error("This transfer invite is no longer active.");
  }

  if (isExpired(transfer.expires_at)) {
    await updateTransferStatus({
      id: transfer.id,
      status: "expired",
      expectedCurrentStatus: "pending",
      metadata: {
        ...(transfer.metadata ?? {}),
        expired_at: new Date().toISOString(),
      },
    });
    throw new Error("This transfer invite has expired.");
  }

  const currentUserEmail = normalizeUserEmail(args.currentUser.email);
  if (
    !currentUserEmail ||
    currentUserEmail !== normalizeUserEmail(transfer.recipient_email)
  ) {
    throw new Error(
      "Sign in with the invited email address before accepting this transfer."
    );
  }

  const assignment = await fetchCurrentAssignmentByTagId(transfer.tag_id);
  if (!assignment || assignment.user_id !== transfer.user_id) {
    throw new Error("This Linket is no longer available for transfer.");
  }

  const activeProfile = await getActiveProfileForUser(args.currentUser.id);
  const result = await grantLinketEntitlementToUser({
    tagId: transfer.tag_id,
    user: args.currentUser,
    source: "linket_transfer",
    pauseSource: "linket_transfer",
    idempotencyKey: `linket-transfer:${transfer.id}`,
    profileId: activeProfile?.id ?? null,
    nickname: assignment.nickname ?? null,
    extraMetadata: {
      transfer_request_id: transfer.id,
      sender_user_id: transfer.user_id,
      recipient_email: transfer.recipient_email,
    },
  });

  await updateTransferStatus({
    id: transfer.id,
    status: "accepted",
    acceptedByUserId: args.currentUser.id,
    metadata: {
      ...(transfer.metadata ?? {}),
      accepted_assignment_id: result.assignmentId,
      accepted_by_user_id: args.currentUser.id,
    },
  });

  return {
    assignmentId: result.assignmentId,
    tagId: transfer.tag_id,
  };
}
