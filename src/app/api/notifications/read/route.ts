import {NextResponse} from "next/server";
import {z} from "zod";import {apiSession,boundedJson} from "@/lib/security/api-session";import {apiError} from "@/lib/api";
export async function POST(req:Request){try{const {db}=await apiSession();const {notificationId}=z.object({notificationId:z.uuid()}).parse(await boundedJson(req));const {error}=await db.rpc("mark_notification_read",{p_notification_id:notificationId});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return apiError(e);}}
