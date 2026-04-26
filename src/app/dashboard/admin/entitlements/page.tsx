import { redirect } from "next/navigation";

import ComplimentaryGrantManager from "@/components/dashboard/admin/ComplimentaryGrantManager";
import { getCurrentUserWithAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminEntitlementsPage() {
  const { user, isAdmin } = await getCurrentUserWithAdmin();
  if (!user) {
    redirect("/auth?view=signin&next=/dashboard/admin/entitlements");
  }
  if (!isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Admin console
        </p>
        <h1 className="text-3xl font-semibold text-foreground">
          Linket entitlements
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Use this repair surface when a Linket was claimed by the wrong account
          first. It reassigns the Linket to the intended recipient and writes the
          complimentary entitlement event the billing system expects.
        </p>
      </header>

      <ComplimentaryGrantManager />
    </div>
  );
}
