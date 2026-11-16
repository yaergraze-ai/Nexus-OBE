import {NextResponse} from "next/server";
import {apiError} from "@/lib/api";
import {apiSession,boundedJson} from "@/lib/security/api-session";
import {submissionInput} from "@/lib/assignments/validation";
export async function POST(req:Request){try{
 const {db}=await apiSession(["mahasiswa"]);
 const entry=submissionInput.parse(await boundedJson(req,450_000));
 const {data:id,error}=await db.rpc("save_submission",{p_assignment_id:entry.assignmentId,p_content:entry.content,p_links:entry.links,p_submit:entry.submit});
 if(error)throw new Error(error.message);
 return NextResponse.json({ok:true,id});
}catch(e){return apiError(e);}}
