SVEGIP staging — complete deployable build with First Administrator Setup.

After redeploy:
1. Open the normal SVEGIP login page.
2. Click “First-time Administrator Setup”.
3. Enter display name, work email, a new password (12+ characters), and the SVEGIP_BOOTSTRAP_SECRET already configured in Netlify.
4. Create the Administrator.
5. Close the setup panel and sign in normally.

Security:
- Bootstrap accepts POST only.
- Bootstrap secret is sent in an HTTP header, never in the URL.
- The backend rejects bootstrap after the first employee account exists.
- The initial Administrator receives accounts.manage, vault.admin, vault.audit and decisions.manage.
- The bootstrap event is written to employee_account_audit.

This ZIP contains the complete frontend, Netlify Functions, Edge Function, assets, and all four database migrations.
