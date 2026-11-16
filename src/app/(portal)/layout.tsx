import {sessionContext} from "@/lib/auth";
import {PortalShell} from "@/components/PortalShell";
export const dynamic="force-dynamic";
export default async function PortalLayout({children}:{children:React.ReactNode}){const {db,profile}=await sessionContext();const {count}=await db.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",profile.id).eq("is_read",false);return <PortalShell profile={profile} initialUnread={count??0}>{children}</PortalShell>;}
