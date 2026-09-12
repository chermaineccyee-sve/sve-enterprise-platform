
export type StoredObject={provider:string;reference:string|null;fileName:string|null;mimeType:string|null;fileSize:number|null};
export async function registerExternalObject(input:{provider?:string;reference?:string|null;fileName?:string|null;mimeType?:string|null;fileSize?:number|null}):Promise<StoredObject>{
 return {provider:input.provider||"INTERIM",reference:input.reference||null,fileName:input.fileName||null,mimeType:input.mimeType||null,fileSize:input.fileSize||null};
}
// Future SVE Database Hub / object-storage implementation plugs in here.
// The portal and document-control API should not depend on a vendor-specific storage SDK.
