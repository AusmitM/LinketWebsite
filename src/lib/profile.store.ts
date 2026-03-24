export type Email = { value: string; type: "work" | "personal"; pref?: boolean };
export type Phone = { value: string; type: "work" | "cell"; pref?: boolean };
export type Address = {
  pobox?: string;
  ext?: string;
  street?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
};
export type Photo = { dataUrl?: string; url?: string; mime?: string } | null;
export type ProfileLink = { title?: string; url: string };

export type ContactProfile = {
  handle: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  org?: string;
  title?: string;
  role?: string;
  emails?: Email[];
  phones?: Phone[];
  address?: Address;
  website?: string;
  links?: ProfileLink[];
  note?: string;
  photo?: Photo;
  uid?: string; // stable id
  updatedAt?: string; // ISO
};
