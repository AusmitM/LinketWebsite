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

// Simple in-memory store keyed by handle. Replace with Prisma later.
const store = new Map<string, ContactProfile>();

// Seed profile for acceptance test
store.set("punit", {
  handle: "punit",
  firstName: "Punit",
  lastName: "Kothakonda",
  org: "Linket",
  title: "Tech Director",
  phones: [{ value: "+18325550123", type: "cell", pref: true }],
  emails: [{ value: "punit@example.com", type: "work", pref: true }],
  address: {
    street: "123 Main St",
    city: "College Station",
    region: "TX",
    postcode: "77840",
    country: "USA",
  },
  website: "https://www.linketconnect.com",
  links: [{ title: "Website", url: "https://www.linketconnect.com" }],
  note: "Photography + product design.",
  uid: "urn:uuid:punit-0001",
  updatedAt: new Date().toISOString(),
});

export async function getProfile(handle: string): Promise<ContactProfile | null> {
  return store.get(handle) ?? null;
}

export async function saveProfile(input: ContactProfile): Promise<ContactProfile> {
  const prev: Partial<ContactProfile> = store.get(input.handle) ?? {};
  const next: ContactProfile = {
    ...prev,
    ...input,
    uid: prev.uid || input.uid || `urn:uuid:${input.handle}`,
    updatedAt: new Date().toISOString(),
  };
  store.set(input.handle, next);
  return next;
}
