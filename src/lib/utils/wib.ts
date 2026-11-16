export function dateTimeWib(iso:string):string {
 return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(iso))+" WIB";
}
export function wibInput(iso:string):string {
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));
 const p=(kind:string)=>parts.find(v=>v.type===kind)?.value??"00";
 return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
export function wibToIso(local:string):string {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new Error("Pilih tanggal dan waktu WIB yang valid.");
 const parsed=new Date(`${local}:00+07:00`);
 if(Number.isNaN(parsed.getTime())||wibInput(parsed.toISOString())!==local)throw new Error("Tanggal WIB tidak valid.");
 return parsed.toISOString();
}
