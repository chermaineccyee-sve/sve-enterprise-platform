/* ===========================================================
   VT Worldwide — Conceptual Lark HR Workflow Visualisation
   Fictional demo data only. No real employee or company data.
   =========================================================== */

const VT_DATA = {

  personas: {
    EMPLOYEE:  { key:'EMPLOYEE',  label:'Employee',          name:'Alex Tan',      role:'Executive, Operations',  dept:'Operations', initials:'AT' },
    MANAGER:   { key:'MANAGER',   label:'Manager / HOD',     name:'Priya Nair',    role:'Head of Operations',     dept:'Operations', initials:'PN' },
    HR:        { key:'HR',        label:'Human Resources',   name:'Michelle Goh',  role:'HR Business Partner',    dept:'Human Resources', initials:'MG' },
    MANAGEMENT:{ key:'MANAGEMENT',label:'Management',        name:'Richard Ooi',   role:'General Manager',        dept:'Management', initials:'RO' }
  },

  navByPersona: {
    EMPLOYEE:  ['home','hr-services','my-requests','policies','performance','notifications'],
    MANAGER:   ['home','approvals','hr-services','notifications'],
    HR:        ['home','approvals','hr-services','policies','performance','hr-admin','notifications'],
    MANAGEMENT:['home','approvals','hr-admin','notifications']
  },

  quickAccess: {
    EMPLOYEE:  [
      {label:'My Requests', icon:'&#128203;', page:'my-requests'},
      {label:'Submit OT', icon:'&#9203;', page:'ot-demo'},
      {label:'Leave', icon:'&#127796;', page:'leave-demo'},
      {label:'Policies', icon:'&#128220;', page:'policies'},
      {label:'Performance', icon:'&#127919;', page:'performance-demo'}
    ],
    MANAGER: [
      {label:'Pending Approvals', icon:'&#9989;', page:'approvals'},
      {label:'Team Attendance', icon:'&#128197;', page:'attendance-demo'},
      {label:'OT Requests', icon:'&#9203;', page:'ot-demo'},
      {label:'Leave Requests', icon:'&#127796;', page:'leave-demo'},
      {label:'Performance Reviews', icon:'&#127919;', page:'performance-demo'}
    ],
    HR: [
      {label:'HR Approval Queue', icon:'&#128203;', page:'approvals'},
      {label:'Exceptions', icon:'&#9888;', page:'ot-demo'},
      {label:'Attendance', icon:'&#128197;', page:'attendance-demo'},
      {label:'Policy Acknowledgement', icon:'&#128220;', page:'policy-demo'},
      {label:'Performance Administration', icon:'&#127919;', page:'performance-demo'},
      {label:'Employee Records', icon:'&#128193;', page:'hr-admin'}
    ],
    MANAGEMENT: [
      {label:'Escalated Approvals', icon:'&#128681;', page:'approvals'},
      {label:'Exceptions', icon:'&#9888;', page:'ot-demo'},
      {label:'HR Control Overview', icon:'&#128202;', page:'hr-admin'}
    ]
  },

  employeeCards: [
    {label:'Apply Leave', icon:'&#127796;', page:'leave-demo', desc:'Submit annual, unpaid or other leave for approval.'},
    {label:'Submit Overtime', icon:'&#9203;', page:'ot-demo', desc:'Claim overtime hours worked with supporting evidence.'},
    {label:'Attendance Correction', icon:'&#128197;', page:'attendance-demo', desc:'Report a missing clock-in / clock-out for review.'},
    {label:'Medical Leave', icon:'&#127973;', page:'medical-demo', desc:'Submit medical leave with a medical certificate.'},
    {label:'Claims', icon:'&#128179;', page:'claims-info', desc:'Submit expense or reimbursement claims (illustrative).'},
    {label:'Policies', icon:'&#128220;', page:'policies', desc:'View and acknowledge company policies.'},
    {label:'Performance Review', icon:'&#127919;', page:'performance-demo', desc:'Complete self-assessment and view review status.'}
  ],

  notificationsSeed: [
    {title:'Welcome to the VT Worldwide workplace concept', body:'This is a conceptual visualisation — no real workflow has been configured yet.', time:'Just now'}
  ],

  ot: {
    employee:'Alex Tan',
    department:'Operations',
    normal: {
      date:'10 September 2026',
      start:'18:00', end:'21:00', brk:'0.5', hours:'3.0',
      reason:'Month-end operational support — closing of September operations report ahead of regional deadline.',
      project:'Month-End Operations Closing',
      doc:'OT-Approval-Email-Sep2026.pdf'
    },
    exception: {
      date:'25 August 2026',
      submittedOn:'8 September 2026',
      windowDays:7,
      daysLate:7,
      hours:'2.5',
      reason:'Forgot to submit within the window due to travel for a client site visit.'
    },
    checklist:[
      'Employee eligible for OT (confirmed employment status)',
      'Manager approved',
      'Attendance reconciled with claimed hours',
      'Working hours checked against policy cap',
      'Duplicate claim checked — none found',
      'Monthly OT accumulation checked — within limit'
    ]
  },

  policy: {
    name:'VT Worldwide Code of Conduct',
    version:'1.0',
    effective:'1 October 2026',
    body:[
      {h:'1. Purpose', p:'This Code of Conduct sets out the standards of behaviour expected of every employee of VT Worldwide in the performance of their duties.'},
      {h:'2. Scope', p:'This policy applies to all employees, contractors and representatives acting on behalf of VT Worldwide.'},
      {h:'3. Workplace Conduct', p:'Employees are expected to act with integrity, treat colleagues with respect, and comply with applicable laws and internal policies at all times.'},
      {h:'4. Conflicts of Interest', p:'Employees must disclose any actual or potential conflict of interest to their manager or Human Resources without delay.'},
      {h:'5. Confidentiality', p:'Employees must protect confidential company and client information and must not disclose it outside authorised channels.'},
      {h:'6. Compliance', p:'Non-compliance with this Code may result in disciplinary action in accordance with VT Worldwide’s disciplinary policy.'}
    ]
  },

  policyMonitor: {
    assigned: 68, acknowledged: 57, outstanding: 8, overdue: 3,
    employees: [
      {name:'Alex Tan', dept:'Operations', status:'Acknowledged', timeline:['Assigned','Notification Sent','Opened','Acknowledged'], date:'12 Sep 2026 · 09:41'},
      {name:'Sarah Lim', dept:'Finance', status:'Acknowledged', timeline:['Assigned','Notification Sent','Opened','Acknowledged'], date:'11 Sep 2026 · 14:02'},
      {name:'Jason Lee', dept:'Sales', status:'Opened – Not Acknowledged', timeline:['Assigned','Notification Sent','Opened'], date:'Opened 12 Sep 2026 · 08:15'},
      {name:'Melissa Wong', dept:'IT', status:'Not Opened', timeline:['Assigned','Notification Sent'], date:'Assigned 9 Sep 2026'},
      {name:'David Chan', dept:'Operations', status:'Overdue', timeline:['Assigned','Reminder','Reminder','Overdue','HR Follow-Up'], date:'Overdue since 13 Sep 2026'}
    ]
  },

  leave: {
    types:['Annual Leave','Unpaid Leave','Compassionate Leave','Emergency Leave'],
    balance:14,
    example:{ type:'Annual Leave', start:'21 September 2026', end:'23 September 2026', days:3, reason:'Family matters' }
  },

  medical: {
    date:'15 September 2026', days:2, doc:'MC-VTClinic-15Sep2026.pdf', clinic:'VT Panel Clinic — Dr. Wong Li Hua'
  },

  attendance: {
    date:'12 September 2026',
    clockIn:'08:59',
    clockOut:null,
    correctedOut:'18:05',
    reason:'Forgot to clock out before leaving for an offsite client meeting.'
  },

  performance: {
    year:2026,
    kpi:{ kra:'Operational Delivery', kpi:'On-Time Completion', weight:'20%', target:'95%', actual:'92%', empRating:4, mgrRating:3 },
    stages:['Employee Self Assessment','Manager Assessment','HOD Review','HR Review','Final Review','Employee Acknowledgement']
  },

  probation: {
    employee:'Jordan Lim (New Employee)', dept:'Marketing', joinDate:'1 June 2026', endDate:'30 November 2026', status:'Review Due'
  },

  offboarding: {
    employee:'Farah Ismail', dept:'Customer Success', lastDay:'30 September 2026', reason:'Resignation — career progression',
    tasks:{
      EMPLOYEE:[ {t:'Work Handover Document', done:true}, {t:'Company Information Handover', done:true}, {t:'Asset Return (laptop, access card)', done:false} ],
      MANAGER:[ {t:'Project Handover Confirmed', done:true}, {t:'Outstanding Work Reassigned', done:true} ],
      IT:[ {t:'Disable Account on Last Day', done:false}, {t:'Preserve Data / Mailbox Archive', done:true}, {t:'Device Check & Collection', done:false} ],
      HR:[ {t:'Employment Documentation Finalised', done:true}, {t:'Attendance / Leave Reconciliation', done:false} ],
      FINANCE:[ {t:'Outstanding Claims Settled', done:true}, {t:'Final Payroll Inputs Prepared', done:false} ]
    }
  },

  currentVsProposed: [
    { area:'Overtime Claims', current:'To be validated with VT Worldwide', proposed:'Employee submits OT in Lark → Manager verifies hours → HR verifies eligibility & attendance → Payroll → Audit record.' },
    { area:'Leave Application', current:'To be validated with VT Worldwide', proposed:'Employee applies leave in Lark → Manager approves → Balance auto-updated → HR record.' },
    { area:'Medical Leave', current:'To be validated with VT Worldwide', proposed:'Employee submits MC digitally → HR verifies → Attendance updated automatically.' },
    { area:'Attendance Correction', current:'To be validated with VT Worldwide', proposed:'Employee reports issue → Manager verifies → HR reviews → Attendance record updated with audit trail.' },
    { area:'Policy Acknowledgement', current:'To be validated with VT Worldwide', proposed:'Policy published in Lark → Employee notified → Read receipt & digital acknowledgement captured → HR monitors completion.' },
    { area:'Performance Review', current:'To be validated with VT Worldwide', proposed:'Self-assessment → Manager → HOD → HR review → Final review → Employee acknowledgement, all recorded in Lark.' },
    { area:'Probation Review', current:'To be validated with VT Worldwide', proposed:'System alerts Manager before probation end date → Outcome recorded (Confirm / Extend / PIP) → HR notified automatically.' },
    { area:'Offboarding', current:'To be validated with VT Worldwide', proposed:'HR triggers offboarding workflow → Tasks auto-assigned to Employee, Manager, IT, HR & Finance → Tracked to completion.' }
  ],

  workshopAreas: ['Overtime Claims','Leave Application','Medical Leave','Attendance Correction','Policy Acknowledgement','Performance Review','Probation Review','Offboarding'],
  workshopCols: ['Current VT Process','Proposed Workflow','VT Confirmation','Gap Identified','Action Required']
};
