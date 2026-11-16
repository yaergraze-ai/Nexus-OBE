import {redirect} from "next/navigation";import {sessionContext} from "@/lib/auth";
export default async function DashboardRedirect(){const {profile}=await sessionContext();redirect(`/dashboard/${profile.role.replace("_","-")}`);}
