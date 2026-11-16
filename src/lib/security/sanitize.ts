import DOMPurify from "isomorphic-dompurify";
export function plainText(input:string):string {return DOMPurify.sanitize(input,{ALLOWED_TAGS:[],ALLOWED_ATTR:[]}).trim();}
export function safeInternalPath(input:string|null|undefined):string {return input?.startsWith("/")&&!input.startsWith("//")&&!input.includes("\\")?input:"/dashboard";}
