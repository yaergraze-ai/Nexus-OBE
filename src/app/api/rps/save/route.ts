import {NextResponse} from "next/server";
import {apiSession,boundedJson} from "@/lib/security/api-session";import {rpsSchema} from "@/lib/validators";import {apiError} from "@/lib/api";
export async function POST(req:Request){try{const {db}=await apiSession(["dosen"]);const v=rpsSchema.parse(await boundedJson(req));const {error}=await db.rpc("replace_rps",{p_class_id:v.classId,p_structure:v.cpls});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return apiError(e);}}
