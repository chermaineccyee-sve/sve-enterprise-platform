import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
const te=new TextEncoder();
function b64url(b:Uint8Array){return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function from64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function hmac(p:string,s:string){const k=await crypto.subtle.importKey("raw",te.encode(s),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",k,te.encode(p))))}
async function verify(p:string,salt:string,expected:string,it:number){const k=await crypto.subtle.importKey("raw",te.encode(p),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:from64(salt),iterations:it},k,256),a=new Uint8Array(bits),b=from64(expected);if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}
export default async(req:Request,context:Context)=>{
 if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
 const secret=Netlify.env.get("SVEGIP_SESSION_SECRET");if(!secret)return Response.json({error:"Authentication is not configured."},{status:503});
 const {email,password}=await req.json().catch(()=>({})),e=String(email||"").trim().toLowerCase(),db=getDatabase();
 const [u]=await db.sql`SELECT * FROM employee_accounts WHERE LOWER(email)=${e} LIMIT 1`;
 if(!u||u.status!=="Active"||!await verify(String(password||""),u.password_salt,u.password_hash,u.password_iterations||210000))return Response.json({error:"Invalid email or password."},{status:401});
 const user={email:e,name:u.name,role:u.role,unit:u.unit,dataVaultAccess:u.data_vault_access,permissions:Array.isArray(u.permissions)?u.permissions:[]};
 const payload=b64url(te.encode(JSON.stringify({...user,exp:Date.now()+28800000}))),sig=await hmac(payload,secret);
 return Response.json({ok:true,user},{headers:{"Set-Cookie":`svegip_session=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`,"Cache-Control":"no-store"}});
};export const config:Config={path:"/api/login"};