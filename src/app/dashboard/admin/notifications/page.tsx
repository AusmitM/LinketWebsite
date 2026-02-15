import { redirect } from "next/navigation";

import NotificationsManager from "@/components/dashboard/admin/NotificationsManager";
import { getCurrentUserWithAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const { user, isAdmin } = await getCurrentUserWithAdmin();
  if (!user) {
    redirect("/auth?view=signin&next=/dashboard/admin/notifications");
  }
  if (!isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
          Admin console
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Format and publish update messages that appear in user dashboards.
        </p>
      </header>
      <NotificationsManager />
    </div>
  );
}
