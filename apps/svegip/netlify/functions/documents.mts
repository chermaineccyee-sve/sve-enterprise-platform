import type { Context,Config } from "@netlify/functions";
import {getDatabase} from "@netlify/database";
import {registerExternalObject} from "./_document-storage.mts";
import {resolveLiveSecurityContext,authorizationResponse} from "./_auth-core.mts";

function isManager(a:any){return a.role==="Administrator"||a.role==="Management"}
function norm(v:any){return String(v??"").trim().toLowerCase()}
async function hasExplicitViewGrant(db:any,a:any,d:any){
 const grants=await db.sql`SELECT id FROM controlled_document_access
   WHERE document_id=${d.id}
     AND LOWER(permission) IN ('view','read')
     AND (
       (LOWER(subject_type) IN ('user','employee','email') AND LOWER(subject_value)=${String(a.email).toLowerCase()}) OR
       (LOWER(subject_type)='role' AND LOWER(subject_value)=${String(a.role).toLowerCase()}) OR
       (LOWER(subject_type) IN ('business_unit','unit') AND LOWER(subject_value)=${String(a.unit).toLowerCase()})
     )
   LIMIT 1`;
 return grants.length>0;
}
async function canSee(db:any,a:any,d:any){
 if(isManager(a))return true;
 if(await hasExplicitViewGrant(db,a,d))return true;
 if(norm(d.classification)==="restricted")return false;
 if(norm(d.business_unit)==="group")return true;
 return norm(d.business_unit)===norm(a.unit);
}

export default async(req:Request,ctx:Context)=>{
 try{
  const a=await resolveLiveSecurityContext(req);
  const db=getDatabase(),url=new URL(req.url),id=Number(url.searchParams.get("id")||0);
  if(req.method==="GET"){
   if(id){
    const [d]=await db.sql`SELECT * FROM controlled_documents WHERE id=${id}`;
    if(!d||!await canSee(db,a,d))return Response.json({error:"Document not found or access restricted."},{status:404});
    const versions=await db.sql`SELECT * FROM controlled_document_versions WHERE document_id=${id} ORDER BY created_at DESC`;
    const access=isManager(a)?await db.sql`SELECT * FROM controlled_document_access WHERE document_id=${id} ORDER BY subject_type,subject_value`:[];
    const audit=isManager(a)?await db.sql`SELECT * FROM controlled_document_audit WHERE document_id=${id} ORDER BY created_at DESC LIMIT 100`:[];
    return Response.json({document:d,versions,access,audit},{headers:{"Cache-Control":"no-store"}});
   }
   const rows=await db.sql`SELECT * FROM controlled_documents ORDER BY updated_at DESC`;
   const documents=[];
   for(const d of rows)if(await canSee(db,a,d))documents.push(d);
   return Response.json({documents},{headers:{"Cache-Control":"no-store"}});
  }
  if(!isManager(a))return Response.json({error:"Management document-control access required."},{status:403});
  if(req.method==="POST"){
   const b:any=await req.json().catch(()=>null);if(!b?.title||!b?.documentCode)return Response.json({error:"Document code and title are required."},{status:400});
   const stored=await registerExternalObject({provider:b.storageProvider,reference:b.storageReference,fileName:b.fileName,mimeType:b.mimeType,fileSize:b.fileSize});
   const [d]=await db.sql`INSERT INTO controlled_documents(document_code,title,business_unit,category,classification,owner_email,status,current_version,storage_provider,storage_reference,file_name,mime_type,file_size,created_by,updated_by)
    VALUES(${b.documentCode},${b.title},${b.businessUnit||"SVE"},${b.category||"General"},${b.classification||"Internal"},${b.ownerEmail||a.email},${b.status||"Draft"},${b.version||"0.1"},${stored.provider},${stored.reference},${stored.fileName},${stored.mimeType},${stored.fileSize},${a.email},${a.email}) RETURNING *`;
   await db.sql`INSERT INTO controlled_document_versions(document_id,version,storage_provider,storage_reference,file_name,mime_type,file_size,change_note,uploaded_by) VALUES(${d.id},${d.current_version},${stored.provider},${stored.reference},${stored.fileName},${stored.mimeType},${stored.fileSize},${b.changeNote||"Initial registration"},${a.email})`;
   await db.sql`INSERT INTO controlled_document_audit(document_id,document_code,action,performed_by,details) VALUES(${d.id},${d.document_code},${"REGISTER"},${a.email},${JSON.stringify({classification:d.classification,unit:d.business_unit,version:d.current_version})}::jsonb)`;
   return Response.json({document:d},{status:201});
  }
  if(req.method==="PATCH"){
   if(!id)return Response.json({error:"Document id required."},{status:400});
   const b:any=await req.json().catch(()=>null);const [old]=await db.sql`SELECT * FROM controlled_documents WHERE id=${id}`;if(!old)return Response.json({error:"Document not found."},{status:404});
   const stored=await registerExternalObject({provider:b.storageProvider||old.storage_provider,reference:b.storageReference??old.storage_reference,fileName:b.fileName??old.file_name,mimeType:b.mimeType??old.mime_type,fileSize:b.fileSize??old.file_size});
   const version=b.version||old.current_version;
   const [d]=await db.sql`UPDATE controlled_documents SET title=${b.title||old.title},business_unit=${b.businessUnit||old.business_unit},category=${b.category||old.category},classification=${b.classification||old.classification},owner_email=${b.ownerEmail||old.owner_email},status=${b.status||old.status},current_version=${version},storage_provider=${stored.provider},storage_reference=${stored.reference},file_name=${stored.fileName},mime_type=${stored.mimeType},file_size=${stored.fileSize},updated_by=${a.email},updated_at=NOW() WHERE id=${id} RETURNING *`;
   if(version!==old.current_version||stored.reference!==old.storage_reference)await db.sql`INSERT INTO controlled_document_versions(document_id,version,storage_provider,storage_reference,file_name,mime_type,file_size,change_note,uploaded_by) VALUES(${id},${version},${stored.provider},${stored.reference},${stored.fileName},${stored.mimeType},${stored.fileSize},${b.changeNote||"New version"},${a.email}) ON CONFLICT(document_id,version) DO NOTHING`;
   await db.sql`INSERT INTO controlled_document_audit(document_id,document_code,action,performed_by,details) VALUES(${id},${old.document_code},${"UPDATE"},${a.email},${JSON.stringify({fromVersion:old.current_version,toVersion:version,classification:d.classification,status:d.status})}::jsonb)`;
   return Response.json({document:d});
  }
  return Response.json({error:"Method not allowed."},{status:405});
 }catch(error){return authorizationResponse(error)}
};
export const config:Config={path:"/api/documents-control"};
