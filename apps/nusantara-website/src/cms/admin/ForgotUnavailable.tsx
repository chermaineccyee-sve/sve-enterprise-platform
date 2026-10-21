import Link from "next/link";
/** /admin/forgot while email password reset is not configured. */
export function ForgotUnavailable() {
  return (
    <div className="nusantara-admin-forgot">
      <h1>Password reset</h1>
      <p>Password reset by email is not available yet. Ask a Nusantara Admin to reset your password.</p>
      <Link href="/admin/login">Back to sign in</Link>
    </div>
  );
}
