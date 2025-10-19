import { NextResponse } from "next/server";
import { getAccountByHandle, getAccountHandleForUser } from "@/lib/profile-service";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const handle = searchParams.get("handle");

  try {
    if (handle) {
      const account = await getAccountByHandle(handle);
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      return NextResponse.json({
        account: {
          ...account,
          avatarPublicUrl: buildAvatarPublicUrl(account.avatar_url, account.avatar_updated_at),
        },
      });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const accountHandle = await getAccountHandleForUser(userId);
    if (!accountHandle) {
      return NextResponse.json({ error: "Handle not found" }, { status: 404 });
    }

    const account = await getAccountByHandle(accountHandle);
    return NextResponse.json({
      userId,
      handle: accountHandle,
      avatarPath: account?.avatar_url ?? null,
      avatarUpdatedAt: account?.avatar_updated_at ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load account handle";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
