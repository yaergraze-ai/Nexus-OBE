import {NextResponse} from "next/server";
import {z} from "zod";import {apiSession,boundedJson} from "@/lib/security/api-session";import {apiError} from "@/lib/api";
export async function POST(req:Request){try{const {db}=await apiSession(["admin","super_admin"]);const {meetingId}=z.object({meetingId:z.uuid()}).parse(await boundedJson(req));const {error}=await db.rpc("override_meeting",{p_meeting_id:meetingId});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return apiError(e);}}
