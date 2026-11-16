export async function postJson<T=unknown>(path:string,payload:unknown):Promise<T>{
 const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),credentials:"same-origin"});
 const json=await response.json() as {error?:string}&T;
 if(!response.ok)throw new Error(json.error||"Permintaan gagal.");
 return json;
}
