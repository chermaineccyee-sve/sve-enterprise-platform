import type { Context, Config } from "@netlify/edge-functions";

export default async(req:Request,context:Context)=>{
 const target=new URL(req.url);
 const authUrl=new URL("/api/vault-authorize",target.origin);
 try{
  const auth=await fetch(authUrl,{method:"GET",headers:{cookie:req.headers.get("cookie")||"",accept:"application/json"},redirect:"manual"});
  if(auth.status===204)return context.next();
 }catch(error){
  console.error("SVE Data Vault authorization gate failed",error);
  return new Response("Authorization service unavailable",{status:503});
 }
 return Response.redirect(new URL("/?next="+encodeURIComponent(target.pathname+target.search),target.origin),302);
};
export const config:Config={path:["/data-vault","/data-vault/*"]};
