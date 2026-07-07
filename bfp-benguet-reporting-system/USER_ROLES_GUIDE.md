# BFP Benguet Reporting System - User Roles & Functions

## Overview
This document describes all user roles in the BFP Benguet Fire Incident Reporting System, their responsibilities, and access levels.

---

## User Roles Hierarchy

### 1. **SUPER_ADMIN** (Level: 100) 
**Full System Access**

**Responsibilities:**
- System administration and configuration
- User account management
- Approve all reports and incidents
- Generate system reports and statistics
- Manage municipalities and system data

**Permissions:**
- ✅ CREATE_REPORT - Create fire incident reports
- ✅ REVIEW_REPORT - Review submitted reports
- ✅ APPROVE_REPORT - Approve reports for dissemination
- ✅ REJECT_REPORT - Reject reports with feedback
- ✅ VIEW_ALL_REPORTS - Access all reports in system
- ✅ MANAGE_USERS - Create, edit, disable user accounts
- ✅ MANAGE_MUNICIPALITIES - Manage municipality data
- ✅ VIEW_STATISTICS - View all system analytics
- ✅ EXPORT_DATA - Export reports and data
- ✅ MANAGE_INCIDENTS - Create and manage incidents

**Default Email:** admin@bfp-benguet.gov.ph
**Default Password:** admin@123

---

### 2. **INVESTIGATOR** (Level: 10)
**Report Creator - Field Level**

**Responsibilities:**
- Investigate fire incidents at the scene
- Prepare initial and detailed fire investigation reports
- Submit investigation reports to Chief Investigator
- Respond to investigator notifications

**Permissions:**
- ✅ CREATE_REPORT - Submit fire investigation reports
- ✅ VIEW_OWN_REPORTS - View reports they submitted
- ✅ VIEW_MUNICIPALITY_REPORTS - View reports from their municipality
- ✅ RECEIVE_NOTIFICATIONS - Get alerts on report status

**Access Level:**
- Can only create reports
- Can view own and municipality-level reports
- Cannot approve or modify other reports

**Default Password:** investigator@123

---

### 3. **CHIEF_INVESTIGATOR_IIS** (Level: 30)
**Investigation Review & Quality Control**

**Responsibilities:**
- Review investigation reports submitted by Investigators
- Verify technical accuracy and completeness
- Request revisions or additional information
- Approve investigations before provincial review
- Document review comments and findings

**Permissions:**
- ✅ CREATE_REPORT - Create corrective reports if needed
- ✅ VIEW_ALL_REPORTS - Access all investigation reports
- ✅ REVIEW_REPORT - Review submitted investigations
- ✅ APPROVE_REPORT - Approve investigation reports
- ✅ REJECT_REPORT - Return for revision with feedback
- ✅ ADD_COMMENTS - Add review notes to reports
- ✅ REQUEST_REVISIONS - Request corrections
- ✅ RECEIVE_NOTIFICATIONS - Get alerts on new submissions

**Access Level:**
- Reviews all investigation reports at provincial level
- Can request changes before approval
- Cannot delete or modify investigation data

**Default Email:** chief.investigator.iis@bfp-benguet.gov.ph
**Default Password:** chiefiis@123

---

### 5. **MUNICIPAL_FIRE_MARSHAL** (Level: 40)
**Municipal Level Supervision**

**Responsibilities:**
- Oversee fire operations at municipal level
- Review and approve reports from lower units
- Monitor incident response
- Coordinate with station units
- Ensure municipal compliance

**Permissions:**
- ✅ CREATE_REPORT - Create municipal reports
- ✅ VIEW_MUNICIPALITY_REPORTS - View municipality reports
- ✅ REVIEW_REPORT - Review submitted reports
- ✅ APPROVE_REPORT - Approve municipal reports
- ✅ REJECT_REPORT - Return reports for revision
- ✅ ADD_COMMENTS - Document review findings
- ✅ MONITOR_INCIDENTS - Track incident status
- ✅ VIEW_STATISTICS - View municipal statistics
- ✅ RECEIVE_NOTIFICATIONS - Get alerts

**Access Level:**
- Assigned to specific municipality
- Reviews reports from their municipality
- Reports to Provincial Chief Investigator

**Default Password:** marshal@123

---

### 6. **PROVINCIAL_CHIEF_INVESTIGATOR** (Level: 50)
**Provincial Investigation Oversight**

**Responsibilities:**
- Oversee all investigation reports at provincial level
- Final review and approval of investigations
- Provide investigation standards and guidance
- Compile provincial investigation statistics
- Report to higher authorities

**Permissions:**
- ✅ CREATE_REPORT - Create investigation reports
- ✅ VIEW_ALL_REPORTS - Access all provincial reports
- ✅ REVIEW_REPORT - Review all investigations
- ✅ APPROVE_REPORT - Final approval of investigations
- ✅ REJECT_REPORT - Return for revision
- ✅ ADD_COMMENTS - Document review findings
- ✅ VIEW_STATISTICS - View provincial investigation stats
- ✅ GENERATE_REPORTS - Create investigation summaries
- ✅ RECEIVE_NOTIFICATIONS - Get alerts

**Access Level:**
- Provincial level authority
- Reviews all municipality investigations
- Final decision on investigation approval

**Default Email:** provincial.chief.investigator@bfp-benguet.gov.ph
**Default Password:** provchief@123

---

### 7. **REGION_IIS** (Level: 55)
**Regional Investigation Service Review**

**Responsibilities:**
- Review investigations at regional level
- Ensure consistency with regional standards
- Monitor regional investigation quality
- Compile regional investigation reports
- Provide feedback to provincial level

**Permissions:**
- ✅ VIEW_ALL_REPORTS - Access all regional reports
- ✅ REVIEW_REPORT - Review reports
- ✅ APPROVE_REPORT - Approve regional reports
- ✅ ADD_COMMENTS - Add regional review notes
- ✅ VIEW_STATISTICS - View regional statistics
- ✅ GENERATE_REPORTS - Create regional summaries
- ✅ RECEIVE_NOTIFICATIONS - Get alerts

**Access Level:**
- Regional level oversight
- Cannot reject reports (escalates instead)
- Monitoring and quality assurance role

**Default Email:** region.iis@bfp-benguet.gov.ph
**Default Password:** regioniis@123

---

### 8. **REGIONAL_CHIEF_OPERATION** (Level: 60)
**Regional Operations Command**

**Responsibilities:**
- Command and control of regional operations
- Review operational compliance at regional level
- Monitor incident response operations
- Approve operations reports
- Coordinate regional fire response

**Permissions:**
- ✅ CREATE_REPORT - Create operational reports
- ✅ VIEW_ALL_REPORTS - Access all operational reports
- ✅ REVIEW_REPORT - Review operations
- ✅ APPROVE_REPORT - Approve operations
- ✅ REJECT_REPORT - Return for revision
- ✅ ADD_COMMENTS - Document decisions
- ✅ MONITOR_INCIDENTS - Track operations
- ✅ VIEW_STATISTICS - View regional operations stats
- ✅ GENERATE_REPORTS - Create operations reports
- ✅ RECEIVE_NOTIFICATIONS - Get alerts

**Access Level:**
- Regional operations authority
- Highest authority at regional level
- Full operational oversight

**Default Email:** regional.chief.operation@bfp-benguet.gov.ph
**Default Password:** regchieops@123

---

### 9. **PIO** (Level: 25)
**Public Information Officer**

**Responsibilities:**
- Access approved reports for public dissemination
- Compile public statistics and information
- Generate public information materials
- Prepare press releases and media content
- Share fire safety statistics with public

**Permissions:**
- ✅ VIEW_APPROVED_REPORTS - Access approved reports only
- ✅ VIEW_STATISTICS - View public statistics
- ✅ EXPORT_DATA - Export approved data
- ✅ GENERATE_PUBLIC_REPORTS - Create public reports
- ✅ RECEIVE_NOTIFICATIONS - Get alerts on approvals

**Access Level:**
- Read-only access to approved reports
- Cannot modify or reject reports
- Limited to public information distribution

**Default Email:** pio@bfp-benguet.gov.ph
**Default Password:** pio@123

---

## Report Workflow & Role Interactions

```
┌─────────────────────────────────────────────────────────────┐
│ FIRE INCIDENT OCCURS                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ INVESTIGATOR creates initial/detailed report                 │
│ (Status: DRAFT → SUBMITTED)                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴─────────────┐
        │                      │
        ▼                      ▼
    ┌─────────────────┐  ┌────────────────────────┐
    │ CHIEF_INVESTI-  │  │ CHIEF_SPECIAL_OPER_   │
    │ GATOR_IIS       │  │ SECTION                │
    │ (Reviews Invest)│  │ (Validates Compliance) │
    └────────┬────────┘  └──────────┬─────────────┘
             │                      │
        ┌────┴──────────────────────┴────┐
        │                                 │
   APPROVE?                          APPROVE?
        │                                 │
        ├─── REJECT: Back to INVESTIGATOR
        │
        ▼
    ┌─────────────────────────────────────┐
    │ MUNICIPAL_FIRE_MARSHAL              │
    │ Reviews/Approves at Municipal Level │
    └────────┬────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────────┐
    │ PROVINCIAL_CHIEF_INVESTIGATOR            │
    │ Final Provincial Review & Approval       │
    │ (Status: SUBMITTED → APPROVED)           │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌───────────────────────────────────────┐
    │ REGION_IIS                            │
    │ Regional Level Quality Assurance      │
    └────────┬────────────────────────────┘
             │
             ▼
    ┌───────────────────────────────────────┐
    │ REGIONAL_CHIEF_OPERATION              │
    │ Regional Operations Final Review      │
    │ (Status: APPROVED)                    │
    └────────┬────────────────────────────┘
             │
             ▼
    ┌───────────────────────────────────────┐
    │ PIO                                   │
    │ Accesses Approved Reports for         │
    │ Public Dissemination                  │
    └───────────────────────────────────────┘
```

---

## Key Features for Role Management

### Using RBAC Utility Functions

```javascript
// Check if user has permission
import { hasPermission, canAccessMunicipality } from '@/lib/rbac';

if (hasPermission(user, 'APPROVE_REPORT')) {
  // Show approve button
}

// Check if user can access municipality
if (canAccessMunicipality(user, municipalityId)) {
  // Allow access
}

// Get role information
import { getRoleInfo } from '@/lib/rbac';
const roleInfo = getRoleInfo('INVESTIGATOR');
console.log(roleInfo.description); // "Creates fire investigation reports"
```

---

## Access Control Summary

| Permission | Super Admin | Investigator | Chief IIS | Spec Ops | Municipal Marshal | Prov Chief | Region IIS | Region Chief | PIO | Viewer |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| CREATE_REPORT | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| VIEW_ALL_REPORTS | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| REVIEW_REPORT | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| APPROVE_REPORT | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| REJECT_REPORT | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| MANAGE_USERS | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| VIEW_STATISTICS | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EXPORT_DATA | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## Next Steps

1. **Run Database Migration:**
   ```bash
   npx prisma migrate dev --name add_user_roles
   ```

2. **Seed Database with Sample Users:**
   ```bash
   node lib/db-seed.js
   ```

3. **Update API Endpoints** to check permissions:
   ```javascript
   import { hasPermission } from '@/lib/rbac';
   
   if (!hasPermission(user, 'APPROVE_REPORT')) {
     return new Response('Forbidden', { status: 403 });
   }
   ```

4. **Update UI Components** to show/hide features based on roles

---

## File Locations

- **Role Definitions:** `/lib/constants.js`
- **RBAC Utilities:** `/lib/rbac.js`
- **Database Schema:** `/prisma/schema.prisma`
- **Seed Script:** `/lib/db-seed.js`
