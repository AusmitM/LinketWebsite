// src/types/db.ts
import type { ThemeName } from "@/lib/themes";

export type UserProfileRecord = {
  id: string;
  user_id: string;
  name: string;
  handle: string;
  headline: string | null;
  theme: ThemeName;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileLinkRecord = {
  id: string;
  profile_id: string;
  user_id: string;
  title: string;
  url: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type Lead = {
  id: string;
  user_id: string;
  handle: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  source_url: string | null;
  created_at: string;
};

export type LeadField = {
  id: string;
  user_id: string;
  handle: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea";
  required: boolean;
  placeholder: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
};

export type HardwareTagRecord = {
  id: string;
  chip_uid: string;
  claim_code: string | null;
  status: "unclaimed" | "claimed" | "retired";
  last_claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TagAssignmentRecord = {
  id: string;
  tag_id: string;
  user_id: string;
  profile_id: string | null;
  nickname: string | null;
  last_redirected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TagEventRecord = {
  id: string;
  tag_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};
