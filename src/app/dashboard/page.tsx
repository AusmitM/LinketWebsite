import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function Dashboard() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=signin&next=%2Fdashboard");
  }

  redirect("/dashboard/overview");
}

