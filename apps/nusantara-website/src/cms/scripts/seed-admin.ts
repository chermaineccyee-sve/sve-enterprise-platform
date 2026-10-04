/**
 * Creates the first Admin account from the environment — no credentials in
 * code or Git:
 *
 *   CMS_SEED_ADMIN_EMAIL=… CMS_SEED_ADMIN_NAME=… CMS_SEED_ADMIN_PASSWORD=… npm run cms:seed-admin
 *
 * Refuses to run when any user already exists. Content is never seeded.
 */
import config from "@payload-config";
import { getPayload } from "payload";

const email = process.env.CMS_SEED_ADMIN_EMAIL;
const name = process.env.CMS_SEED_ADMIN_NAME;
const password = process.env.CMS_SEED_ADMIN_PASSWORD;

if (!email || !name || !password) {
  console.error("Set CMS_SEED_ADMIN_EMAIL, CMS_SEED_ADMIN_NAME and CMS_SEED_ADMIN_PASSWORD.");
  process.exit(1);
}

const payload = await getPayload({ config });
const { totalDocs } = await payload.count({ collection: "users", overrideAccess: true });
if (totalDocs > 0) {
  console.error(`Refusing: ${totalDocs} user(s) already exist. Create further accounts in the Admin Portal.`);
  process.exit(1);
}
await payload.create({ collection: "users", data: { email, name, password, role: "admin" }, overrideAccess: true });
console.info(`Admin account created for ${email}.`);
process.exit(0);
