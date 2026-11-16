import {NextResponse} from "next/server";
import {z} from "zod";import {apiSession,boundedJson} from "@/lib/security/api-session";import {apiError} from "@/lib/api";
export async function POST(req:Request){try{const {db}=await apiSession(["super_admin"]);const v=z.object({userId:z.uuid(),role:z.enum(["mahasiswa","dosen","admin","super_admin"])}).parse(await boundedJson(req));const {error}=await db.rpc("change_user_role",{p_user_id:v.userId,p_role:v.role});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return apiError(e);}}
