// Usage:
// node create-user.mjs "email" "Display Name" "Role" "Unit" "password" true '["vault.audit"]'
import crypto from "node:crypto";
const [email,name,role,unit,password,dv="true",permissionsJson="[]"]=process.argv.slice(2);
if(!password){console.error('Usage: node create-user.mjs email "Name" Role Unit password [dataVaultAccess] [permissionsJson]');process.exit(1)}
const iterations=210000,salt=crypto.randomBytes(16),hash=crypto.pbkdf2Sync(password,salt,iterations,32,"sha256");
let permissions=[];try{permissions=JSON.parse(permissionsJson)}catch{}
console.log(JSON.stringify({
 email:email.toLowerCase(),name,role,unit,status:"Active",
 dataVaultAccess:dv!=="false",permissions,iterations,
 salt:salt.toString("base64"),passwordHash:hash.toString("base64")
},null,2));
