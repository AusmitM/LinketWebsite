"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/system/toaster";
import { confirmRemove } from "@/lib/confirm-remove";
import { QrCode } from "lucide-react";

type TelType = "cell" | "work" | "home" | "fax" | "pager" | "text" | "voice" | "other";
type EmailType = "work" | "home" | "other";
type UrlType = "homepage" | "blog" | "portfolio" | "company" | "other";
type AddrType = "home" | "work" | "other";
type ImppType = "skype" | "whatsapp" | "xmpp" | "telegram" | "signal" | "discord" | "slack" | "facetime" | "wechat" | "msn" | "aim" | "icq" | "yahoo" | "other";
type SocialType = "twitter" | "facebook" | "instagram" | "linkedin" | "github" | "youtube" | "tiktok" | "snapchat" | "threads" | "other";

type Phone = { type: TelType; value: string };
type Email = { type: EmailType; value: string };
type Url = { type: UrlType; value: string };
type Address = { type: AddrType; label?: string; poBox?: string; extended?: string; street?: string; city?: string; region?: string; postalCode?: string; country?: string };
type Impp = { type: ImppType; uri: string };
type Social = { type: SocialType; url: string };
type Related = { type: string; value: string };

type FormState = {
  version: "4.0" | "3.0" | "2.1";
  kind: "individual" | "group" | "org" | "location";
  uid?: string;
  source?: string;
  prodid?: string;
  n_family?: string; n_given?: string; n_additional?: string; n_prefix?: string; n_suffix?: string;
  fn?: string;
  nickname?: string;
  gender?: "M" | "F" | "O" | "N" | "U" | "";
  bday?: string; anniversary?: string;
  org?: string; org_unit?: string; title?: string; role?: string;
  note?: string; categories?: string;
  photo_url?: string; logo_url?: string; sound_url?: string; key_url?: string;
  tz?: string; langs?: string; geo_lat?: string; geo_lon?: string;
  phones: Phone[]; emails: Email[]; urls: Url[]; addresses: Address[]; impps: Impp[]; socials: Social[]; related: Related[];
  customProps: { name: string; value: string }[];
};

const defaultState: FormState = {
  version: "4.0",
  kind: "individual",
  uid: "",
  prodid: "-//Linket Connect//VCardBuilder//EN",
  n_family: "", n_given: "", n_additional: "", n_prefix: "", n_suffix: "",
  fn: "",
  nickname: "",
  gender: "",
  bday: "", anniversary: "",
  org: "", org_unit: "", title: "", role: "",
  note: "", categories: "",
  photo_url: "", logo_url: "", sound_url: "", key_url: "",
  tz: "", langs: "", geo_lat: "", geo_lon: "",
  phones: [{ type: "cell", value: "" }],
  emails: [{ type: "work", value: "" }],
  urls: [{ type: "homepage", value: "" }],
  addresses: [{ type: "home", label: "Home", street: "", city: "", region: "", postalCode: "", country: "" }],
  impps: [], socials: [], related: [],
  customProps: [],
};

function esc(v: string) {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function fold(line: string) {
  const limit = 75; if (line.length <= limit) return line; const out: string[] = []; let i = 0;
  while (i < line.length) { const chunk = line.slice(i, i + limit); out.push(i === 0 ? chunk : " " + chunk); i += limit; }
  return out.join("\r\n");
}
function rid() {
  try {
    const a = new Uint8Array(16);
    const g = globalThis as unknown as { crypto?: Crypto; msCrypto?: Crypto };
    const c = g.crypto ?? g.msCrypto;
    if (!c) throw new Error("Crypto API unavailable");
    c.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}
function normImpp(type: Impp["type"], uri: string) {
  const raw = uri.trim(); if (/^[a-z]+:/i.test(raw)) return raw;
  switch (type) {
    case "skype": return `skype:${raw}`;
    case "whatsapp": return raw.startsWith("http") ? raw : `https://wa.me/${raw.replace(/[^0-9]/g, "")}`;
    case "telegram": return raw.startsWith("http") ? raw : `https://t.me/${raw}`;
    case "signal": return raw.startsWith("http") ? raw : `https://signal.me/#p/${raw.replace(/[^0-9]/g, "")}`;
    case "discord": return raw.startsWith("http") ? raw : `https://discordapp.com/users/${raw}`;
    case "slack": return raw.startsWith("http") ? raw : `https://${raw}.slack.com`;
    case "facetime": return `facetime:${raw}`;
    case "xmpp": return `xmpp:${raw}`;
    default: return raw;
  }
}
function buildVCard(f: FormState) {
  const L: string[] = []; const NL = "\r\n"; const V = f.version; const push = (s: string)=>{ if (s) L.push(fold(s)); };
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const uid = (f.uid||"").trim() || rid();
  const fn = (f.fn?.trim() || [f.n_prefix, f.n_given, f.n_additional, f.n_family, f.n_suffix].filter(Boolean).join(" ") || f.org || "").trim();
  push("BEGIN:VCARD"); push(`VERSION:${V}`); if (f.prodid) push(`PRODID:${esc(f.prodid)}`); push(`UID:${esc(uid)}`); if (f.kind && V==="4.0") push(`KIND:${f.kind}`);
  const N = [f.n_family||"", f.n_given||"", f.n_additional||"", f.n_prefix||"", f.n_suffix||""].map(esc).join(";"); push(`N:${N}`);
  if (fn) push(`FN:${esc(fn)}`); if (f.nickname?.trim()) push(`NICKNAME:${esc(f.nickname.trim())}`);
  if (f.bday) push(`BDAY:${f.bday}`); if (f.anniversary && V==="4.0") push(`ANNIVERSARY:${f.anniversary}`);
  if (f.org || f.org_unit) { const org = [f.org||"", f.org_unit||""].map(esc).join(";"); push(`ORG:${org}`); }
  if (f.title) push(`TITLE:${esc(f.title)}`); if (f.role) push(`ROLE:${esc(f.role)}`);
  if (f.photo_url) push(`PHOTO;VALUE=uri:${esc(f.photo_url)}`); if (f.logo_url) push(`LOGO;VALUE=uri:${esc(f.logo_url)}`); if (f.sound_url) push(`SOUND;VALUE=uri:${esc(f.sound_url)}`); if (f.key_url) push(`KEY;VALUE=uri:${esc(f.key_url)}`);
  for (const p of f.phones.filter(x=>x.value.trim())) { const t=p.type.toUpperCase(); if (V==="4.0") push(`TEL;TYPE=${t};VALUE=uri:tel:${esc(p.value.trim())}`); else push(`TEL;TYPE=${t}:${esc(p.value.trim())}`); }
  for (const e of f.emails.filter(x=>x.value.trim())) { const t=e.type.toUpperCase(); push(`EMAIL;TYPE=${t}:${esc(e.value.trim())}`); }
  for (const a of f.addresses) { const has=[a.poBox,a.extended,a.street,a.city,a.region,a.postalCode,a.country].some(x=>(x||"").trim()); if(!has) continue; const parts=[a.poBox,a.extended,a.street,a.city,a.region,a.postalCode,a.country].map(v=>esc(v||"")); const label=a.label?.trim()?`;LABEL=\"${esc(a.label.trim())}\"`:""; push(`ADR;TYPE=${a.type.toUpperCase()}${label}:${parts.join(";")}`); }
  for (const u of f.urls.filter(x=>x.value.trim())) { const t=u.type.toUpperCase(); push(`URL;TYPE=${t}:${esc(u.value.trim())}`); }
  for (const i of f.impps.filter(x=>x.uri.trim())) { const t=i.type.toUpperCase(); if (V==="4.0") push(`IMPP;TYPE=${t}:${esc(normImpp(i.type,i.uri))}`); else push(`X-IM;TYPE=${t}:${esc(normImpp(i.type,i.uri))}`); }
  for (const s of f.socials.filter(x=>x.url.trim())) { const t=s.type.toLowerCase(); push(`X-SOCIALPROFILE;type=${t}:${esc(s.url.trim())}`); }
  if (f.categories?.trim()) push(`CATEGORIES:${esc(f.categories.trim())}`); if (f.gender) push(`GENDER:${f.gender}`);
  if (f.langs?.trim()) { for (const lang of f.langs.split(/[ ,]+/).filter(Boolean)) push(`LANG:${esc(lang)}`); }
  if (f.tz?.trim()) push(`TZ:${esc(f.tz.trim())}`); if (f.geo_lat?.trim() && f.geo_lon?.trim()) push(`GEO:geo:${esc(f.geo_lat.trim())},${esc(f.geo_lon.trim())}`);
  for (const r of f.related.filter(x=>x.value.trim())) { const typ=r.type?.trim(); const param=typ?`;TYPE=${typ}`:""; push(`RELATED${param}:${esc(r.value.trim())}`); }
  if (f.note?.trim()) push(`NOTE:${esc(f.note.trim())}`); if (f.source?.trim()) push(`SOURCE:${esc(f.source.trim())}`); push(`REV:${now}`);
  for (const c of f.customProps.filter(x=>x.name.trim() && x.value.trim())) { push(`${c.name.trim().toUpperCase()}:${esc(c.value.trim())}`); }
  push("END:VCARD");
  return L.join(NL);
}

export default function VCardBuilder() {
  const [form, setForm] = useState<FormState>(defaultState);
  const vcard = useMemo(() => { try { return buildVCard(form); } catch (e) { console.error('vCard build failed', e); return 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:\r\nEND:VCARD'; } }, [form]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>vCard Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="version">Version</Label>
            <Select value={form.version} onValueChange={(v) => setForm((f) => ({ ...f, version: v as FormState["version"] }))}>
              <SelectTrigger id="version"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4.0">4.0 (recommended)</SelectItem>
                <SelectItem value="3.0">3.0</SelectItem>
                <SelectItem value="2.1">2.1</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kind">Kind</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as FormState["kind"] }))}>
              <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="org">Organization</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="location">Location</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uid">UID (optional)</Label>
            <Input id="uid" value={form.uid} onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))} placeholder="auto if empty" />
          </div>
        </div>

        <Tabs defaultValue="identity">
          <TabsList>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="online">Online</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="identity">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-1.5"><Label htmlFor="n_family">Family</Label><Input id="n_family" value={form.n_family} onChange={(e) => setForm((f) => ({ ...f, n_family: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="n_given">Given</Label><Input id="n_given" value={form.n_given} onChange={(e) => setForm((f) => ({ ...f, n_given: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="n_additional">Additional</Label><Input id="n_additional" value={form.n_additional} onChange={(e) => setForm((f) => ({ ...f, n_additional: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="n_prefix">Prefix</Label><Input id="n_prefix" value={form.n_prefix} onChange={(e) => setForm((f) => ({ ...f, n_prefix: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="n_suffix">Suffix</Label><Input id="n_suffix" value={form.n_suffix} onChange={(e) => setForm((f) => ({ ...f, n_suffix: e.target.value }))} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-4 mt-4">
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="fn">Full name (FN)</Label><Input id="fn" value={form.fn} onChange={(e) => setForm((f) => ({ ...f, fn: e.target.value }))} placeholder="Displayed name" /></div>
              <div className="space-y-1.5"><Label htmlFor="nickname">Nickname(s)</Label><Input id="nickname" value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} placeholder="comma-separated" /></div>
              <div className="space-y-1.5"><Label htmlFor="bday">Birthday</Label><Input id="bday" type="date" value={form.bday} onChange={(e) => setForm((f) => ({ ...f, bday: e.target.value }))} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select value={form.gender || ""} onValueChange={(v)=> setForm((f)=> ({...f, gender: v as FormState["gender"]}))}>
                  <SelectTrigger id="gender"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unspecified</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="N">None</SelectItem>
                    <SelectItem value="O">Other</SelectItem>
                    <SelectItem value="U">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="anniv">Anniversary</Label><Input id="anniv" type="date" value={form.anniversary} onChange={(e)=> setForm((f)=> ({...f, anniversary: e.target.value}))} /></div>
              <div className="space-y-1.5"><Label htmlFor="photo">Photo URL</Label><Input id="photo" value={form.photo_url} onChange={(e)=> setForm((f)=> ({...f, photo_url: e.target.value}))} placeholder="https://..." /></div>
              <div className="space-y-1.5"><Label htmlFor="logo">Logo URL</Label><Input id="logo" value={form.logo_url} onChange={(e)=> setForm((f)=> ({...f, logo_url: e.target.value}))} placeholder="https://..." /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3 mt-4">
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="sound">Sound URL</Label><Input id="sound" value={form.sound_url} onChange={(e)=> setForm((f)=> ({...f, sound_url: e.target.value}))} placeholder="https://..." /></div>
              <div className="space-y-1.5 md:col-span-1"><Label htmlFor="key">Key (PGP/SSH) URL</Label><Input id="key" value={form.key_url} onChange={(e)=> setForm((f)=> ({...f, key_url: e.target.value}))} placeholder="https://..." /></div>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Phone numbers</h3>
              {form.phones.map((p, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label className="sr-only" htmlFor={`tel-type-${idx}`}>Type</Label>
                    <Select value={p.type} onValueChange={(v) => setForm((f) => ({ ...f, phones: f.phones.map((x,i)=> i===idx? { ...x, type: v as TelType }: x) }))}>
                      <SelectTrigger id={`tel-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["cell","work","home","fax","pager","text","voice","other"] as TelType[]).map((t)=> (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="sr-only" htmlFor={`tel-${idx}`}>Number</Label>
                    <Input
                      id={`tel-${idx}`}
                      type="tel"
                      value={p.value}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          phones: f.phones.map((x, i) =>
                            i === idx
                              ? { ...x, value: formatPhoneNumber(e.target.value) }
                              : x
                          ),
                        }))
                      }
                      placeholder="(555) 123 - 4567"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this phone number?")) return;
                        setForm((f) => ({
                          ...f,
                          phones: f.phones.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, phones: [...f.phones, { type: "cell", value: "" }]}))}>Add phone</Button>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Emails</h3>
              {form.emails.map((e, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label className="sr-only" htmlFor={`email-type-${idx}`}>Type</Label>
                    <Select value={e.type} onValueChange={(v) => setForm((f) => ({ ...f, emails: f.emails.map((x,i)=> i===idx? { ...x, type: v as EmailType }: x) }))}>
                      <SelectTrigger id={`email-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["work","home","other"] as EmailType[]).map((t)=> (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="sr-only" htmlFor={`email-${idx}`}>Email</Label>
                    <Input id={`email-${idx}`} value={e.value} onChange={(ev) => setForm((f)=> ({...f, emails: f.emails.map((x,i)=> i===idx? { ...x, value: ev.target.value }: x)}))} placeholder="name@example.com" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this email?")) return;
                        setForm((f) => ({
                          ...f,
                          emails: f.emails.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, emails: [...f.emails, { type: "work", value: "" }]}))}>Add email</Button>
            </section>
          </TabsContent>

          <TabsContent value="addresses" className="space-y-4">
            {form.addresses.map((a, idx) => (
              <div key={idx} className="space-y-3 rounded-xl border p-3">
                <div className="grid gap-2 md:grid-cols-6">
                  <div>
                    <Label className="sr-only" htmlFor={`addr-type-${idx}`}>Type</Label>
                    <Select value={a.type} onValueChange={(v) => setForm((f) => ({ ...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, type: v as AddrType }: x) }))}>
                      <SelectTrigger id={`addr-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["home","work","other"] as AddrType[]).map((t)=> (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="sr-only" htmlFor={`addr-label-${idx}`}>Label</Label>
                    <Input id={`addr-label-${idx}`} placeholder="Label (eg. Home)" value={a.label || ""} onChange={(e) => setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, label: e.target.value }: x)}))} />
                  </div>
                  <div className="md:col-span-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this address?")) return;
                        setForm((f) => ({
                          ...f,
                          addresses: f.addresses.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div><Label htmlFor={`addr-street-${idx}`}>Street</Label><Input id={`addr-street-${idx}`} value={a.street || ""} onChange={(e)=> setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, street: e.target.value }: x)}))} /></div>
                  <div><Label htmlFor={`addr-city-${idx}`}>City</Label><Input id={`addr-city-${idx}`} value={a.city || ""} onChange={(e)=> setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, city: e.target.value }: x)}))} /></div>
                  <div><Label htmlFor={`addr-region-${idx}`}>Region/State</Label><Input id={`addr-region-${idx}`} value={a.region || ""} onChange={(e)=> setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, region: e.target.value }: x)}))} /></div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div><Label htmlFor={`addr-postal-${idx}`}>Postal code</Label><Input id={`addr-postal-${idx}`} value={a.postalCode || ""} onChange={(e)=> setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, postalCode: e.target.value }: x)}))} /></div>
                  <div><Label htmlFor={`addr-country-${idx}`}>Country</Label><Input id={`addr-country-${idx}`} value={a.country || ""} onChange={(e)=> setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, country: e.target.value }: x)}))} /></div>
                  <div><Label htmlFor={`addr-po-${idx}`}>PO Box</Label><Input id={`addr-po-${idx}`} value={a.poBox || ""} onChange={(e)=> setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, poBox: e.target.value }: x)}))} /></div>
                </div>
                <div>
                  <Label htmlFor={`addr-ext-${idx}`}>Extended</Label>
                  <Input id={`addr-ext-${idx}`} value={a.extended || ""} onChange={(e)=> setForm((f)=> ({...f, addresses: f.addresses.map((x,i)=> i===idx? { ...x, extended: e.target.value }: x)}))} />
                </div>
              </div>
            ))}
            <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, addresses: [...f.addresses, { type: "home", street: "", city: "", region: "", postalCode: "", country: "" }]}))}>Add address</Button>
          </TabsContent>

          <TabsContent value="work">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="org">Organization</Label><Input id="org" value={form.org} onChange={(e) => setForm((f) => ({ ...f, org: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="org_unit">Department/Unit</Label><Input id="org_unit" value={form.org_unit} onChange={(e) => setForm((f) => ({ ...f, org_unit: e.target.value }))} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="space-y-1.5"><Label htmlFor="title">Title</Label><Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="role">Role</Label><Input id="role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} /></div>
            </div>
          </TabsContent>

          <TabsContent value="online" className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Websites</h3>
              {form.urls.map((u, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label className="sr-only" htmlFor={`url-type-${idx}`}>Type</Label>
                    <Select value={u.type} onValueChange={(v) => setForm((f) => ({ ...f, urls: f.urls.map((x,i)=> i===idx? { ...x, type: v as UrlType }: x) }))}>
                      <SelectTrigger id={`url-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["homepage","blog","portfolio","company","other"] as UrlType[]).map((t)=> (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="sr-only" htmlFor={`url-${idx}`}>URL</Label>
                    <Input id={`url-${idx}`} value={u.value} onChange={(e) => setForm((f)=> ({...f, urls: f.urls.map((x,i)=> i===idx? { ...x, value: e.target.value }: x)}))} placeholder="https://example.com" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this website?")) return;
                        setForm((f) => ({
                          ...f,
                          urls: f.urls.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, urls: [...f.urls, { type: "homepage", value: "" }]}))}>Add website</Button>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Instant messaging (IMPP)</h3>
              {form.impps.map((i, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label className="sr-only" htmlFor={`im-type-${idx}`}>Type</Label>
                    <Select value={i.type} onValueChange={(v) => setForm((f) => ({ ...f, impps: f.impps.map((x,i2)=> i2===idx? { ...x, type: v as ImppType }: x) }))}>
                      <SelectTrigger id={`im-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["skype","whatsapp","xmpp","telegram","signal","discord","slack","facetime","wechat","msn","aim","icq","yahoo","other"] as ImppType[]).map((t)=> (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="sr-only" htmlFor={`im-uri-${idx}`}>Handle or URI</Label>
                    <Input id={`im-uri-${idx}`} value={i.uri} onChange={(e) => setForm((f)=> ({...f, impps: f.impps.map((x,i2)=> i2===idx? { ...x, uri: e.target.value }: x)}))} placeholder="e.g. skype:username or username" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this IM entry?")) return;
                        setForm((f) => ({
                          ...f,
                          impps: f.impps.filter((_, i2) => i2 !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, impps: [...f.impps, { type: "skype", uri: "" }]}))}>Add IM</Button>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Social profiles</h3>
              {form.socials.map((s, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label className="sr-only" htmlFor={`soc-type-${idx}`}>Type</Label>
                    <Select value={s.type} onValueChange={(v) => setForm((f) => ({ ...f, socials: f.socials.map((x,i2)=> i2===idx? { ...x, type: v as SocialType }: x) }))}>
                      <SelectTrigger id={`soc-type-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["twitter","facebook","instagram","linkedin","github","youtube","tiktok","snapchat","threads","other"] as SocialType[]).map((t)=> (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="sr-only" htmlFor={`soc-url-${idx}`}>URL</Label>
                    <Input id={`soc-url-${idx}`} value={s.url} onChange={(e) => setForm((f)=> ({...f, socials: f.socials.map((x,i2)=> i2===idx? { ...x, url: e.target.value }: x)}))} placeholder="https://..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this social profile?")) return;
                        setForm((f) => ({
                          ...f,
                          socials: f.socials.filter((_, i2) => i2 !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, socials: [...f.socials, { type: "twitter", url: "" }]}))}>Add profile</Button>
            </section>
          </TabsContent>

          <TabsContent value="other" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="note">Notes</Label><Textarea id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={4} /></div>
              <div className="space-y-1.5"><Label htmlFor="categories">Categories</Label><Input id="categories" value={form.categories} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))} placeholder="comma-separated" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1.5"><Label htmlFor="langs">Languages</Label><Input id="langs" value={form.langs} onChange={(e)=> setForm((f)=> ({...f, langs: e.target.value}))} placeholder="e.g. en, fr" /></div>
              <div className="space-y-1.5"><Label htmlFor="tz">Time zone</Label><Input id="tz" value={form.tz} onChange={(e)=> setForm((f)=> ({...f, tz: e.target.value}))} placeholder="America/New_York or +05:30" /></div>
              <div className="space-y-1.5"><Label htmlFor="lat">Latitude</Label><Input id="lat" value={form.geo_lat} onChange={(e)=> setForm((f)=> ({...f, geo_lat: e.target.value}))} placeholder="40.7128" /></div>
              <div className="space-y-1.5"><Label htmlFor="lon">Longitude</Label><Input id="lon" value={form.geo_lon} onChange={(e)=> setForm((f)=> ({...f, geo_lon: e.target.value}))} placeholder="-74.0060" /></div>
            </div>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Related</h3>
              {form.related.map((r, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2"><Label className="sr-only" htmlFor={`rel-type-${idx}`}>Type</Label><Input id={`rel-type-${idx}`} value={r.type} onChange={(e)=> setForm((f)=> ({...f, related: f.related.map((x,i)=> i===idx? { ...x, type: e.target.value }: x)}))} placeholder="e.g. friend, spouse" /></div>
                  <div className="md:col-span-3"><Label className="sr-only" htmlFor={`rel-val-${idx}`}>Value</Label><Input id={`rel-val-${idx}`} value={r.value} onChange={(e)=> setForm((f)=> ({...f, related: f.related.map((x,i)=> i===idx? { ...x, value: e.target.value }: x)}))} placeholder="mailto:..., tel:..., urn:uuid:..., or text" /></div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this related entry?")) return;
                        setForm((f) => ({
                          ...f,
                          related: f.related.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, related: [...f.related, { type: "friend", value: "" }]}))}>Add related</Button>
            </section>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="prodid">PRODID</Label><Input id="prodid" value={form.prodid} onChange={(e)=> setForm((f)=> ({...f, prodid: e.target.value}))} /></div>
              <div className="space-y-1.5"><Label htmlFor="source">Source URL</Label><Input id="source" value={form.source} onChange={(e)=> setForm((f)=> ({...f, source: e.target.value}))} placeholder="https://..." /></div>
              <div className="space-y-1.5"><Label htmlFor="uid2">UID (override)</Label><Input id="uid2" value={form.uid} onChange={(e)=> setForm((f)=> ({...f, uid: e.target.value}))} placeholder="auto if empty" /></div>
            </div>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Custom properties</h3>
              {form.customProps.map((c, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2"><Label className="sr-only" htmlFor={`c-name-${idx}`}>Name</Label><Input id={`c-name-${idx}`} value={c.name} onChange={(e)=> setForm((f)=> ({...f, customProps: f.customProps.map((x,i)=> i===idx? { ...x, name: e.target.value }: x)}))} placeholder="e.g. X-CUSTOM" /></div>
                  <div className="md:col-span-3"><Label className="sr-only" htmlFor={`c-val-${idx}`}>Value</Label><Input id={`c-val-${idx}`} value={c.value} onChange={(e)=> setForm((f)=> ({...f, customProps: f.customProps.map((x,i)=> i===idx? { ...x, value: e.target.value }: x)}))} placeholder="value" /></div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        if (!confirmRemove("Are you sure you want to remove this custom property?")) return;
                        setForm((f) => ({
                          ...f,
                          customProps: f.customProps.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="rounded-2xl" onClick={()=> setForm((f)=> ({...f, customProps: [...f.customProps, { name: "X-", value: "" }]}))}>Add property</Button>
            </section>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="preview">Preview (.vcf)</Label>
          <Textarea id="preview" readOnly value={vcard} rows={8} className="font-mono" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-2xl" onClick={() => {
            const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(form.fn || form.n_given || "vcard").replace(/[^a-z0-9-_]+/gi, "_")}.vcf`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          }}>Download .vcf</Button>
          <Button variant="outline" className="rounded-2xl" onClick={async () => {
            try {
              await navigator.clipboard.writeText(vcard);
              toast({ title: ".vcf copied", variant: "success" });
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : undefined;
              toast({ title: "Copy failed", description: message, variant: "destructive" });
            }
          }}>Copy</Button>
          <Button variant="outline" className="rounded-2xl" onClick={() => setForm(defaultState)}>Reset</Button>
          <details className="group ml-auto">
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]">
              <span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4" /> QR</span>
            </summary>
            <div className="mt-3 rounded-xl border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=164x164&data=${encodeURIComponent(vcard)}`}
                alt="vCard QR"
                width={164}
                height={164}
              />
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
}
