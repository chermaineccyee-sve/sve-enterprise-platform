import fs from 'node:fs';

const file='data-vault/index.html';
let s=fs.readFileSync(file,'utf8');
const before=s;

// Remove the original page-history router. Existing controls are retained and
// resolved through router.js compatibility aliases.
s=s.replace(/let pageHistory=\['dashboard'\];\nfunction goPage\(id,fromBack=false,preserveMatter=false\)\{.*?\nfunction injectBackButtons\(\)\{.*?\n\}\n/s,'');

// Remove legacy navigation layers that compete with the canonical router.
s=s.replace(/\/\* V15\.4 canonical Home routing \*\/\n\(function\(\)\{.*?\n\}\)\(\);\n/s,'');
s=s.replace(/<script id="sidebar-single-active-fix">.*?<\/script>\s*/s,'');
s=s.replace(/<script id="v261-routing-fixes">.*?<\/script>\s*/s,'');

// Remove the unsupported standalone Research & Data Collection page. Matter
// Source Monitoring remains because it routes to the supported News/Policy monitor.
s=s.replace(/<section id="research" class="page">.*?<\/section>\s*<\/section>/s,'');

// Consulting Method is a visible methodology reference, not a route.
s=s.replace('<button class="method-link" type="button" onclick="openConsultingMethod()">SVE CONSULTING METHOD →</button>',
  '<span class="method-link method-static" aria-label="SVE Consulting Method reference">SVE CONSULTING METHOD</span>');
s=s.replace(/function openConsultingMethod\(\)\{.*?\n\}/s,'function openConsultingMethod(){ return false; }');

// Keep project/matter context in the canonical router state.
s=s.replace('window.SVE_CURRENT_PROJECT={name:name,jur:jur,work:work,status:status,pct:pct}; window.SVE_CURRENT_MATTER=name;',
`window.SVE_CURRENT_PROJECT={name:name,jur:jur,work:work,status:status,pct:pct}; window.SVE_CURRENT_MATTER=name;
 if(window.SVEVaultRouter)window.SVEVaultRouter.setMatter(window.SVE_CURRENT_PROJECT);`);

// Load the one canonical router before the session/access bridge.
if(!s.includes('<script src="./router.js"></script>')){
  s=s.replace('<script id="svegip-session-bridge">','<script src="./router.js"></script>\n<script id="svegip-session-bridge">');
}

// V26 responsive rules were appended after </html>; keep them but restore valid
// document structure so all behaviour is inside the document body.
s=s.replace('</script></body></html><style id="v26-mobile-final-fixes">','</script><style id="v26-mobile-final-fixes">');
if(!s.trimEnd().endsWith('</html>')) s=s.trimEnd()+'\n</body></html>\n';

if(s===before){console.log('Data Vault already structurally integrated.');process.exit(0);}
fs.writeFileSync(file,s);
console.log('Integrated canonical Data Vault router into '+file);
