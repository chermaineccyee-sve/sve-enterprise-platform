/* eslint-disable @next/next/no-img-element -- Payload admin graphics; the site's brand files are served as-is */
/**
 * Nusantara identity in the Admin Portal: the code-controlled brand files from
 * /public/brand (never CMS media), with Payload's layout otherwise unchanged.
 */
export function Logo() {
  return (
    <div className="nusantara-admin-logo">
      <img src="/brand/nusantara-logo-h84@2x.png" alt="Nusantara Fund Management" width={94} height={84} />
      <span>Nusantara Administration</span>
    </div>
  );
}

export function Icon() {
  return <img className="nusantara-admin-icon" src="/brand/nusantara-mark.png" alt="Nusantara Administration" width={26} height={25} />;
}

/** Replaces the email password-reset link while no email service is configured. */
export function LoginHelp() {
  return <p className="nusantara-admin-login-help">Forgotten your password? Ask a Nusantara Admin to reset it.</p>;
}
