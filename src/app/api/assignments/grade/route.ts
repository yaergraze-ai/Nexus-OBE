import {NextResponse} from "next/server";
import {apiError} from "@/lib/api";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {gradeInput} from "@/lib/assignments/validation";
export async function POST(req:Request){try{
 const {db}=await apiSession(["dosen","admin","super_admin"]);const entry=gradeInput.parse(await boundedJson(req,6000));
 const {error}=await db.rpc("grade_submission",{p_submission_id:entry.submissionId,p_score:entry.score,p_feedback:entry.feedback});if(error)throw new Error(error.message);
 return NextResponse.json({ok:true});
}catch(e){return apiError(e);}}
