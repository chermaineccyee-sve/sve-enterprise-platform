import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { resolveLiveSecurityContext, authorizationResponse } from "./_auth-core.mts";

const te=new TextEncoder();
function b64(b:Uint8Array){return btoa(String.fromCharCode(...b))}
async function hashPassword(password:string){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iterations=210000;
 const key=await crypto.subtle.importKey("raw",te.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},key,256);
 return {salt:b64(salt),hash:b64(new Uint8Array(bits)),iterations};
}
function canManageAccounts(actor:any){return actor.role==="Administrator"||actor.permissions.includes("accounts.manage")}

export default async(req:Request,context:Context)=>{
 try{
  const a=await resolveLiveSecurityContext(req);
  if(!canManageAccounts(a))return Response.json({error:"Administrator access required."},{status:403});
  const db=getDatabase();
  if(req.method==="GET"){
   const url=new URL(req.url),id=Number(url.searchParams.get("id")||0);
   if(id){
    const [user]=await db.sql`SELECT id,email,name,role,unit,status,data_vault_access,permissions,created_at,updated_at FROM employee_accounts WHERE id=${id}`;
    if(!user)return Response.json({error:"Account not found."},{status:404});
    const audit=await db.sql`SELECT id,action,performed_by,details,created_at FROM employee_account_audit WHERE employee_email=${user.email} ORDER BY created_at DESC LIMIT 100`;
    return Response.json({user,audit},{headers:{"Cache-Control":"no-store"}});
   }
   const rows=await db.sql`SELECT id,email,name,role,unit,status,data_vault_access,permissions,created_at,updated_at FROM employee_accounts ORDER BY name,email`;
   return Response.json({users:rows},{headers:{"Cache-Control":"no-store"}});
  }
  const body:any=await req.json().catch(()=>({}));
  if(req.method==="POST"){
   const email=String(body.email||"").trim().toLowerCase(),name=String(body.name||"").trim(),role=String(body.role||"Employee"),unit=String(body.unit||"SVE"),password=String(body.password||"");
   if(!email||!name||password.length<8)return Response.json({error:"Name, email and a password of at least 8 characters are required."},{status:400});
   const h=await hashPassword(password),permissions=JSON.stringify(Array.isArray(body.permissions)?body.permissions:[]);
   try{
    const [u]=await db.sql`INSERT INTO employee_accounts(email,name,role,unit,status,data_vault_access,permissions,password_salt,password_hash,password_iterations) VALUES(${email},${name},${role},${unit},${body.status||"Active"},${body.dataVaultAccess===true},${permissions}::jsonb,${h.salt},${h.hash},${h.iterations}) RETURNING id,email,name,role,unit,status,data_vault_access,permissions`;
    await db.sql`INSERT INTO employee_account_audit(employee_email,action,performed_by,details) VALUES(${email},${"CREATE"},${a.email},${JSON.stringify({role,unit})}::jsonb)`;
    return Response.json({user:u},{status:201});
   }catch(e){return Response.json({error:"Unable to create account. The email may already exist."},{status:409})}
  }
  if(req.method==="PATCH"){
   const id=Number(body.id);if(!id)return Response.json({error:"Account id required."},{status:400});
   const [existing]=await db.sql`SELECT * FROM employee_accounts WHERE id=${id}`;if(!existing)return Response.json({error:"Account not found."},{status:404});
   const permissions=JSON.stringify(Array.isArray(body.permissions)?body.permissions:existing.permissions||[]);
   let salt=existing.password_salt,hash=existing.password_hash,it=existing.password_iterations;
   if(body.password){
    if(String(body.password).length<8)return Response.json({error:"Password must be at least 8 characters."},{status:400});
    const h=await hashPassword(String(body.password));salt=h.salt;hash=h.hash;it=h.iterations;
   }
   const [u]=await db.sql`UPDATE employee_accounts SET name=${body.name??existing.name},role=${body.role??existing.role},unit=${body.unit??existing.unit},status=${body.status??existing.status},data_vault_access=${body.dataVaultAccess===undefined?existing.data_vault_access:body.dataVaultAccess===true},permissions=${permissions}::jsonb,password_salt=${salt},password_hash=${hash},password_iterations=${it},updated_at=NOW() WHERE id=${id} RETURNING id,email,name,role,unit,status,data_vault_access,permissions,updated_at`;
   await db.sql`INSERT INTO employee_account_audit(employee_email,action,performed_by,details) VALUES(${existing.email},${"UPDATE"},${a.email},${JSON.stringify({role:u.role,unit:u.unit,status:u.status,dataVaultAccess:u.data_vault_access})}::jsonb)`;
   return Response.json({user:u});
  }
  return Response.json({error:"Method not allowed"},{status:405});
 }catch(error){return authorizationResponse(error)}
};
export const config:Config={path:"/api/admin/users"};
