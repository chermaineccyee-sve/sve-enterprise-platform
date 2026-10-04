/**
 * Creates the first Admin account from a trusted machine — the server-side
 * alternative to the /admin/bootstrap window. No credentials in code or Git:
 *
 *   DATABASE_URL="$DATABASE_URL_UNPOOLED" CMS_SEED_ADMIN_EMAIL=… CMS_SEED_ADMIN_NAME=… npm run cms:seed-admin
 *
 * The password is asked for interactively (not echoed, not kept in shell
 * history); CMS_SEED_ADMIN_PASSWORD is accepted for non-interactive use.
 * Refuses to run when any user already exists. Content is never seeded.
 */
import config from "@payload-config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { getPayload } from "payload";

const email = process.env.CMS_SEED_ADMIN_EMAIL;
const name = process.env.CMS_SEED_ADMIN_NAME;

if (!email || !name) {
  console.error("Set CMS_SEED_ADMIN_EMAIL and CMS_SEED_ADMIN_NAME.");
  process.exit(1);
}

function askHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

let password = process.env.CMS_SEED_ADMIN_PASSWORD;
if (!password) {
  if (!process.stdin.isTTY) {
    console.error("No terminal for the password prompt; set CMS_SEED_ADMIN_PASSWORD.");
    process.exit(1);
  }
  password = await askHidden("Password for the first Admin (min. 12 characters): ");
  if ((await askHidden("Repeat the password: ")) !== password) {
    console.error("The passwords do not match.");
    process.exit(1);
  }
}

const payload = await getPayload({ config });
const { totalDocs } = await payload.count({ collection: "users", overrideAccess: true });
if (totalDocs > 0) {
  console.error(`Refusing: ${totalDocs} user(s) already exist. Create further accounts in the Admin Portal.`);
  process.exit(1);
}
await payload.create({ collection: "users", data: { email, name, password, role: "admin" }, overrideAccess: true });
console.info(`Admin account created for ${email}. Sign in at /admin to verify it.`);
process.exit(0);
