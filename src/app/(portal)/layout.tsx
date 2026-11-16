import { sessionContext } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { db, profile } = await sessionContext();
  const [{ count }, avatarSigned] = await Promise.all([
    db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
    profile.avatar_url
      ? db.storage.from("profile-avatars").createSignedUrl(profile.avatar_url, 3600)
      : Promise.resolve(null),
  ]);

  return (
    <PortalShell
      profile={profile}
      initialUnread={count ?? 0}
      avatarUrl={avatarSigned?.data?.signedUrl ?? null}
    >
      {children}
    </PortalShell>
  );
}
