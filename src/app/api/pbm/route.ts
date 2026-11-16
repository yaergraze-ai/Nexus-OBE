import {NextResponse} from "next/server";
import {z} from "zod";import {apiSession,boundedJson} from "@/lib/security/api-session";import {apiError} from "@/lib/api";
export async function POST(req:Request){try{const {db}=await apiSession(["admin","super_admin"]);const v=z.object({classId:z.uuid(),state:z.enum(["on","off"])}).parse(await boundedJson(req));const {error}=await db.rpc("update_pbm",{p_class_id:v.classId,p_state:v.state});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return apiError(e);}}
