import { getDatabase } from "@netlify/database";

const te = new TextEncoder();

function un64(s:string){
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}

export class AuthorizationError extends Error{
  status:number;
  constructor(status:number,message:string){super(message);this.status=status;}
}

export type LiveSecurityContext={
  id:number;
  email:string;
  name:string;
  role:string;
  unit:string;
  status:string;
  dataVaultAccess:boolean;
  permissions:string[];
};

function normalizePermissions(value:any):string[]{
  if(Array.isArray(value))return value.map(String);
  if(typeof value==="string"){
    try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(String):[];}catch{return [];}
  }
  return [];
}

async function signedSession(req:Request){
  const secret=Netlify.env.get("SVEGIP_SESSION_SECRET");
  const token=(req.headers.get("cookie")||"").match(/(?:^|;\s*)svegip_session=([^;]+)/)?.[1];
  if(!secret||!token)throw new AuthorizationError(401,"Authentication required.");
  const [payload,signature]=token.split(".");
  if(!payload||!signature)throw new AuthorizationError(401,"Authentication required.");
  const key=await crypto.subtle.importKey("raw",te.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  if(!await crypto.subtle.verify("HMAC",key,un64(signature),te.encode(payload)))throw new AuthorizationError(401,"Authentication required.");
  try{
    const decoded=JSON.parse(new TextDecoder().decode(un64(payload)));
    if(!decoded?.email||decoded.exp<=Date.now())throw new AuthorizationError(401,"Authentication required.");
    return decoded;
  }catch(e){
    if(e instanceof AuthorizationError)throw e;
    throw new AuthorizationError(401,"Authentication required.");
  }
}

export async function resolveLiveSecurityContext(req:Request):Promise<LiveSecurityContext>{
  const signed=await signedSession(req);
  const db=getDatabase();
  const [account]=await db.sql`SELECT id,email,name,role,unit,status,data_vault_access,permissions FROM employee_accounts WHERE LOWER(email)=${String(signed.email).toLowerCase()} LIMIT 1`;
  if(!account)throw new AuthorizationError(403,"Account not found or access revoked.");
  if(account.status!=="Active")throw new AuthorizationError(403,"Account is not active.");
  return {
    id:Number(account.id),
    email:String(account.email),
    name:String(account.name),
    role:String(account.role),
    unit:String(account.unit),
    status:String(account.status),
    dataVaultAccess:account.data_vault_access===true,
    permissions:normalizePermissions(account.permissions)
  };
}

export function authorizationResponse(error:unknown){
  if(error instanceof AuthorizationError)return Response.json({error:error.message},{status:error.status,headers:{"Cache-Control":"no-store"}});
  console.error("SVEGIP authorization/runtime error",error);
  return Response.json({error:"Server error."},{status:500,headers:{"Cache-Control":"no-store"}});
}
