import type { Context, Config } from "@netlify/functions";
import { resolveLiveSecurityContext, authorizationResponse } from "./_auth-core.mts";

export default async(req:Request,_context:Context)=>{
 try{
  if(req.method!=="GET"&&req.method!=="HEAD")return Response.json({error:"Method not allowed."},{status:405});
  const actor=await resolveLiveSecurityContext(req);
  if(!actor.dataVaultAccess)return Response.json({error:"SVE Data Vault access is not assigned to this account."},{status:403,headers:{"Cache-Control":"no-store"}});
  return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
 }catch(error){return authorizationResponse(error)}
};
export const config:Config={path:"/api/vault-authorize"};
