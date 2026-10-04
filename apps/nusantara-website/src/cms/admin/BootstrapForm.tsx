import config from "@payload-config";
import Link from "next/link";
import { getPayload } from "payload";
import { bootstrapConfigured } from "../bootstrap";

/**
 * /admin/bootstrap — open only while CMS_BOOTSTRAP_TOKEN is set AND no account
 * exists. Says nothing else about the configuration.
 */
export async function BootstrapForm({ state }: { state?: string }) {
  const payload = await getPayload({ config });
  const { totalDocs } = await payload.count({ collection: "users", overrideAccess: true });
  const open = bootstrapConfigured() && totalDocs === 0;
  return (
    <div className="nusantara-admin-forgot">
      <h1>Set up the first Admin</h1>
      {open ? (
        <>
          <p>Enter the bootstrap token from the deployment settings. It unlocks the form for the first Admin account for 15 minutes.</p>
          {state === "invalid" && <p role="alert">That token is not valid.</p>}
          <form method="post" action="/api/cms-bootstrap" className="nusantara-bootstrap-form">
            <label htmlFor="bootstrap-token">Bootstrap token</label>
            <input id="bootstrap-token" name="token" type="password" autoComplete="off" required minLength={32} />
            <button type="submit" className="btn btn--style-primary">Continue</button>
          </form>
        </>
      ) : (
        <p>Set-up is closed. Accounts are created by a Nusantara Admin.</p>
      )}
      <Link href="/admin/login">Back to sign in</Link>
    </div>
  );
}
