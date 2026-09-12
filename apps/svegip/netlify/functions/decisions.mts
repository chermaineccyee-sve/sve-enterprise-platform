import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { resolveLiveSecurityContext, authorizationResponse } from "./_auth-core.mts";

function canRead(a:any){return ["Administrator","Management","Executive Office"].includes(a?.role)}
function canWrite(a:any){return a?.role==="Administrator"||a?.role==="Management"||(a?.permissions||[]).includes("decisions.manage")}
async function nextCode(db:any){
 const rows=await db.sql`SELECT decision_code FROM management_decisions WHERE decision_code LIKE 'SVE-DEC-%' ORDER BY id DESC LIMIT 1`;
 const last=rows?.[0]?.decision_code||"SVE-DEC-0000";
 const n=(parseInt(String(last).split("-").pop()||"0",10)||0)+1;
 return "SVE-DEC-"+String(n).padStart(4,"0");
}

export default async(req:Request, context:Context)=>{
 let a:any;try{a=await resolveLiveSecurityContext(req)}catch(error){return authorizationResponse(error)}
 if(!canRead(a))return Response.json({error:"Management / Executive Office access required."},{status:403});
 const db=getDatabase(), url=new URL(req.url), id=Number(url.searchParams.get("id")||0);

 if(req.method==="GET"){
   if(id){
     const [decision]=await db.sql`SELECT * FROM management_decisions WHERE id=${id}`;
     if(!decision)return Response.json({error:"Decision not found."},{status:404});
     const audit=await db.sql`SELECT * FROM management_decision_audit WHERE decision_id=${id} ORDER BY created_at DESC`;
     return Response.json({decision,audit},{headers:{"Cache-Control":"no-store"}});
   }
   const decisions=await db.sql`SELECT * FROM management_decisions ORDER BY 
     CASE status WHEN 'Decision Required' THEN 1 WHEN 'Direction Given' THEN 2 WHEN 'Implementation' THEN 3 WHEN 'Closed' THEN 4 ELSE 5 END,
     due_date NULLS LAST, updated_at DESC`;
   return Response.json({decisions},{headers:{"Cache-Control":"no-store"}});
 }

 if(!canWrite(a))return Response.json({error:"Management decision write access required."},{status:403});

 if(req.method==="POST"){
   const b:any=await req.json().catch(()=>null);
   if(!b?.title)return Response.json({error:"Decision title is required."},{status:400});
   const code=b.decisionCode||await nextCode(db);
   const [d]=await db.sql`INSERT INTO management_decisions(
     decision_code,title,description,source_type,source_reference,linked_project,linked_meeting,linked_data_vault_id,priority,status,direction,owner_email,due_date,implementation_note,created_by,updated_by
   ) VALUES(
     ${code},${b.title},${b.description||null},${b.sourceType||"General"},${b.sourceReference||null},${b.linkedProject||null},${b.linkedMeeting||null},${b.linkedDataVaultId||null},
     ${b.priority||"Medium"},${b.status||"Decision Required"},${b.direction||null},${b.ownerEmail||null},${b.dueDate||null},${b.implementationNote||null},${a.email},${a.email}
   ) RETURNING *`;
   await db.sql`INSERT INTO management_decision_audit(decision_id,action,performed_by,details)
      VALUES(${d.id},${"CREATE"},${a.email},${JSON.stringify({status:d.status,priority:d.priority,sourceType:d.source_type})}::jsonb)`;
   return Response.json({decision:d},{status:201});
 }

 if(req.method==="PATCH"){
   if(!id)return Response.json({error:"Decision id required."},{status:400});
   const b:any=await req.json().catch(()=>null);
   const [old]=await db.sql`SELECT * FROM management_decisions WHERE id=${id}`;
   if(!old)return Response.json({error:"Decision not found."},{status:404});
   const nextStatus=b.status||old.status;
   const closedAt=nextStatus==="Closed" ? (old.closed_at||new Date().toISOString()) : null;
   const [d]=await db.sql`UPDATE management_decisions SET
      title=${b.title??old.title},
      description=${b.description??old.description},
      source_type=${b.sourceType??old.source_type},
      source_reference=${b.sourceReference??old.source_reference},
      linked_project=${b.linkedProject??old.linked_project},
      linked_meeting=${b.linkedMeeting??old.linked_meeting},
      linked_data_vault_id=${b.linkedDataVaultId??old.linked_data_vault_id},
      priority=${b.priority??old.priority},
      status=${nextStatus},
      direction=${b.direction??old.direction},
      owner_email=${b.ownerEmail??old.owner_email},
      due_date=${b.dueDate??old.due_date},
      implementation_note=${b.implementationNote??old.implementation_note},
      closed_at=${closedAt},
      updated_by=${a.email},
      updated_at=NOW()
      WHERE id=${id} RETURNING *`;
   await db.sql`INSERT INTO management_decision_audit(decision_id,action,performed_by,details)
      VALUES(${id},${"UPDATE"},${a.email},${JSON.stringify({fromStatus:old.status,toStatus:d.status,owner:d.owner_email,dueDate:d.due_date})}::jsonb)`;
   return Response.json({decision:d});
 }

 return Response.json({error:"Method not allowed."},{status:405});
};
export const config:Config={path:"/api/decisions"};
