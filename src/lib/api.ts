import {NextResponse} from "next/server";
import {ZodError} from "zod";
export function apiError(error:unknown,status=400){
 const message=error instanceof ZodError?error.issues.map(i=>i.message).join(" "):error instanceof Error?error.message:"Permintaan tidak valid.";
 return NextResponse.json({error:message},{status});
}
