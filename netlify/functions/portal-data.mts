import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { resolveLiveSecurityContext, authorizationResponse } from "./_auth-core.mts";

const MODULES=new Set(["announcements","projects","policies","documents","meetings","actions"]);
const MANAGEMENT_ROLES=new Set(["Administrator","Management"]);
const EXECUTIVE_ROLES=new Set(["Administrator","Management","Executive Office"]);

function norm(v:any){return String(v??"").trim().toLowerCase()}
function isGroupValue(v:any){return ["all sve","all","group","sve group","everyone"].includes(norm(v))}
function sameUnit(value:any,unit:string){
 const v=norm(value),u=norm(unit);
 if(!v||!u)return false;
 if(v===u)return true;
 return v.split(/\s*[/,&+]\s*/).some(x=>x===u);
}
function announcementVisible(actor:any,record:any){
 const audience=record?.audience;
 return !audience||isGroupValue(audience)||norm(audience)===norm(actor.role)||sameUnit(audience,actor.unit);
}
function projectVisible(actor:any,record:any){
 if(MANAGEMENT_ROLES.has(actor.role))return true;
 if(actor.role==="Executive Office")return sameUnit(record?.unit,actor.unit)||isGroupValue(record?.unit);
 if(actor.role==="SKL User / Legal Reviewer")return sameUnit(record?.unit,"SKL");
 return false;
}
function policyVisible(actor:any,record:any){
 if(MANAGEMENT_ROLES.has(actor.role))return true;
 const code=norm(record?.code),owner=record?.owner;
 if(actor.unit==="SKL")return code.startsWith("skl-")||sameUnit(owner,"SKL")||(!code.startsWith("skl-")&&!sameUnit(owner,"SKL"));
 return !code.startsWith("skl-")&&!sameUnit(owner,"SKL");
}
function documentVisible(actor:any,record:any){
 if(MANAGEMENT_ROLES.has(actor.role))return true;
 const access=record?.access;
 if(!access||isGroupValue(access))return true;
 if(norm(access)===norm(actor.role)||sameUnit(access,actor.unit))return true;
 return false;
}
function meetingVisible(actor:any,_record:any){
 // Pilot data does not yet carry an audience/unit field for meetings.
 // RBAC baseline permits meetings to standard and SKL users.
 return true;
}
function actionVisible(actor:any,_record:any){return EXECUTIVE_ROLES.has(actor.role)}
function recordVisible(actor:any,module:string,record:any){
 switch(module){
  case "announcements":return announcementVisible(actor,record);
  case "projects":return projectVisible(actor,record);
  case "policies":return policyVisible(actor,record);
  case "documents":return documentVisible(actor,record);
  case "meetings":return meetingVisible(actor,record);
  case "actions":return actionVisible(actor,record);
  default:return false;
 }
}
function canWrite(actor:any){return MANAGEMENT_ROLES.has(actor?.role)}
function canReadPortalAudit(actor:any){return actor?.role==="Administrator"}

export default async(req:Request,context:Context)=>{
 try{
  const actor=await resolveLiveSecurityContext(req);
  const db=getDatabase(),url=new URL(req.url),module=url.searchParams.get("module")||"";
  if(req.method==="GET"){
    const rows=await db.sql`SELECT module,record_id,data FROM portal_records ORDER BY module,record_id`;
    const audit=canReadPortalAudit(actor)?await db.sql`SELECT id,module,record_id,action,performed_by,details,created_at FROM portal_business_audit ORDER BY created_at DESC LIMIT 100`:[];
    const result:any={announcements:[],projects:[],policies:[],documents:[],meetings:[],actions:[],people:[],audit:audit.map((x:any)=>({id:x.id,when:x.created_at,module:x.module,action:x.action,performedBy:x.performed_by,details:x.details}))};
    for(const r of rows){if(result[r.module]&&recordVisible(actor,r.module,r.data))result[r.module].push(r.data)}
    return Response.json({data:result},{headers:{"Cache-Control":"no-store"}});
  }
  if(!canWrite(actor))return Response.json({error:"Management write access required."},{status:403});
  if(!MODULES.has(module))return Response.json({error:"Invalid module."},{status:400});
  if(req.method==="POST"){
    const body=await req.json().catch(()=>null);if(!body||typeof body!=="object")return Response.json({error:"Record required."},{status:400});
    let id=Number((body as any).id||0);
    if(!id){const [n]=await db.sql`SELECT COALESCE(MAX(record_id),0)+1 AS id FROM portal_records WHERE module=${module}`;id=Number(n.id)}
    const record={...(body as any),id},payload=JSON.stringify(record);
    const [existing]=await db.sql`SELECT record_id FROM portal_records WHERE module=${module} AND record_id=${id}`;
    await db.sql`INSERT INTO portal_records(module,record_id,data,created_by,updated_by) VALUES(${module},${id},${payload}::jsonb,${actor.email},${actor.email})
      ON CONFLICT(module,record_id) DO UPDATE SET data=EXCLUDED.data,updated_by=${actor.email},updated_at=NOW()`;
    const action=existing?"UPDATE":"CREATE";
    await db.sql`INSERT INTO portal_business_audit(module,record_id,action,performed_by,details) VALUES(${module},${id},${action},${actor.email},${JSON.stringify({label:record.title||record.name||record.code||String(id)})}::jsonb)`;
    return Response.json({record},{status:existing?200:201});
  }
  if(req.method==="DELETE"){
    const id=Number(url.searchParams.get("id")||0);if(!id)return Response.json({error:"Record id required."},{status:400});
    const [existing]=await db.sql`SELECT data FROM portal_records WHERE module=${module} AND record_id=${id}`;if(!existing)return Response.json({error:"Record not found."},{status:404});
    await db.sql`DELETE FROM portal_records WHERE module=${module} AND record_id=${id}`;
    const rec=existing.data||{};
    await db.sql`INSERT INTO portal_business_audit(module,record_id,action,performed_by,details) VALUES(${module},${id},${"DELETE"},${actor.email},${JSON.stringify({label:rec.title||rec.name||rec.code||String(id)})}::jsonb)`;
    return Response.json({ok:true});
  }
  return Response.json({error:"Method not allowed."},{status:405});
 }catch(error){return authorizationResponse(error)}
};
export const config:Config={path:"/api/portal-data"};
