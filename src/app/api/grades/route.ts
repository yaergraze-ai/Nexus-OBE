import {NextResponse} from "next/server";
import {apiSession,boundedJson} from "@/lib/security/api-session";import {scoreSchema} from "@/lib/validators";import {apiError} from "@/lib/api";
export async function POST(req:Request){try{const {db}=await apiSession(["dosen","admin","super_admin"]);const v=scoreSchema.parse(await boundedJson(req));const {error}=await db.rpc("save_grade",{p_class_id:v.classId,p_student_id:v.studentId,p_scores:v.scores});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return apiError(e);}}
