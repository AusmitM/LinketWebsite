import { redirect } from "next/navigation";
import { getGlobalActiveProfile } from "@/lib/profile-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicRoot() {
  const profile = await getGlobalActiveProfile();
  if (!profile) {
    redirect("/");
  }
  redirect(`/u/${encodeURIComponent(profile.handle)}`);
}
