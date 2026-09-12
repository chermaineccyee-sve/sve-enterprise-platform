SVE GROUP INTERNAL PORTAL — MANAGEMENT REVIEW BUILD v6 / v0.1

Target production domain:
https://svegip.com

WHAT IS INCLUDED
- Branded SVE login/review screen
- SVE dashboard
- Executive Office workspace
- SK Lai & Partners dedicated corporate theme
- Projects & Clients
- Corporate Governance / Policy Registry
- People & HR
- Knowledge & Documents
- Announcements
- Meetings
- Action tracking
- Demo Users & Roles
- Administration CMS
- Audit log
- Global search
- Browser persistence using localStorage
- Vercel-ready static deployment files

REVIEW LOGIN
This build intentionally uses a demo role selector.
It is NOT production authentication.

PRODUCTION SECURITY
Before confidential data is added, replace the demo session layer with:
- approved SVE identity provider / SSO
- secure shared database
- server-side role enforcement
- protected document storage
- production audit controls

LOCAL REVIEW
Open index.html in a modern browser.

VERCEL
This folder can be deployed as a static site.

V6 POLISH PASS
- Executive Office upgraded to management dashboard
- Persistent SKL workspace context across Matters, SOPs and Documents
- SKL-specific filtering and controlled resources
- Management Review v0.1 positioning
- Improved executive presentation

V7 FIX PASS
- Restored / hardened SK Lai & Partners logo rendering
- Universal Back button on every workspace
- Dashboard return button
- Breadcrumb navigation
- Navigation history preserves SKL context

V8 GROUP ARCHITECTURE
- Landing dashboard repositioned as SVE Group Home
- Two primary business-unit gateways: SVE International and SK Lai & Partners
- New dedicated SVE International workspace
- SVE corporate functions grouped under SVE International
- SKL remains a dedicated professional unit under SVE Group
- Breadcrumbs now reflect Group > Business Unit > Workspace hierarchy

V9 CONTEXTUAL SIDEBAR
- Group-level sidebar reduced to Group Home + two business-unit gateways
- SVE International receives its own contextual navigation
- SK Lai & Partners receives dedicated burgundy/gold contextual navigation
- Workspace identity and return-to-group control integrated into sidebar

V10 FINAL GROUP HOME POLISH
- Removed circular SVE GROUP badge
- Reworked Group Home toward modern corporate intranet layout
- Two clear SVE International / SK Lai & Partners gateways
- Added announcements, upcoming meetings and key updates
- Added concise Group Resources in contextual sidebar

V11 LANDING PAGE BRAND AMENDMENT
- Added “Sustainable. Venture. Equity.” beneath the SVE Group Internal Portal heading
- Retained People | Ideas | Partnerships | A Better Tomorrow
- No KLCC or photographic hero image
- Refined abstract purple/orange corporate wave background using CSS only
