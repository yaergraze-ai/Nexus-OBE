import {NextResponse} from "next/server";
import {z} from "zod";import {apiSession,boundedJson} from "@/lib/security/api-session";import {apiError} from "@/lib/api";
import {classRecipientIds,deliver} from "@/lib/security/notifications";
export async function POST(req:Request){try{
 const {db}=await apiSession(["admin","super_admin"]);const {classId,authority}=z.object({classId:z.uuid(),authority:z.enum(["kaprodi","dekan"])}).parse(await boundedJson(req));
 const {error}=await db.rpc("validate_rps",{p_class_id:classId,p_authority:authority});if(error)throw new Error(error.message);
 try{await deliver(await classRecipientIds(classId),{title:"Validasi RPS diperbarui",body:`Validasi ${authority} untuk RPS kelas telah disetujui.`,category:"RPS",url:`/kelas/${classId}/rps`},true);}catch(e){console.error(e);}
 return NextResponse.json({ok:true});
}catch(e){return apiError(e);}}
