# Partners Module - Complete Specification

## Project Overview

**CUOS (Creative Upaay Operating System)** is a full-stack ERP system built with:
- **Backend:** Node.js + Express + TypeScript + MongoDB
- **Frontend:** React + Vite + TypeScript + Redux Toolkit (RTK Query) + TailwindCSS

## Current System Architecture

### Existing Modules (6 modules)
1. **Project Management** - Manage projects, tasks, time logs, meetings, credentials, documents, notes
2. **Finance** - Track expenses, invoices, and financial reports
3. **CRM** - Customer relationship management (pipeline, leads, proposals, clients)
4. **HRMS** - Human resource management and employee records
5. **Overall Admin** - System administration, user permissions, roles, audit logs
6. **Hiring** - Job postings, applications, assignments, interviews
7. **Client Portal** - Standalone portal for clients to view their projects (separate authentication)

### Authentication & Authorization System
- **User Model:** Users have roles (super-admin, admin, manager, finance, hr, employee)
- **Role Model:** Roles have permissions (resources + actions)
- **Module Permissions:** Each user has granular module permissions stored in `modulePermissions` field
- **Permission Levels:** Feature-level permissions via middleware (`checkPermission`)

## The New Requirement: Partners Module

### Business Context
Creative Upaay works with **external partners** who act as intermediaries. These partners:
- Refer/close clients on behalf of the company
- Need limited access to add and manage their clients
- Need to create projects under their clients
- Should NOT have full system access like employees

### Key Differentiators: Partners vs. Employees
| Aspect | Employees | Partners |
|--------|-----------|----------|
| **Entity Type** | Internal staff | External collaborators |
| **Access Scope** | Full system (based on role) | Limited to CRM + Projects |
| **Data Visibility** | See all company data (based on permissions) | See only their own clients/projects |
| **HRMS Profile** | Yes (have Employee record) | No (no Employee record) |
| **Onboarding** | Employee onboarding form | Partner registration form |
| **Authentication** | Login via CUOS | Login via CUOS |
| **Modules Visible** | All assigned modules | Only CRM + Projects |

## Detailed Requirements

### 1. Partner User Creation & Management

#### 1.1 Partner Role
- A new role called **"Partner"** should be added to the system
- Partners should appear in **Overall Admin > Users** (they are CUOS users)
- Partners have their own dedicated management interface

#### 1.2 Partner Registration Flow
- Admins create a Partner user in **Partners Module** or **Overall Admin > Users**
- System generates a unique registration token/link
- Admin sends this link to the partner
- Partner fills a registration form (similar to employee onboarding) with their details:
  - Name, Email, Phone
  - Company Name (if any)
  - Address
  - Other relevant details
- After submission, partner account is activated and they receive login credentials

#### 1.3 Partner Details Storage
- Create a **Partner Model** (separate from Employee model) to store partner-specific information
- Fields: `userId`, `companyName`, `contactPerson`, `phone`, `email`, `address`, `registrationToken`, `registrationStatus`, etc.

### 2. Partner-Client Relationship

#### 2.1 Client Ownership
- **Clients are owned by the company**, NOT by the partner
- Partners act as "referrers" or "creators" of the client
- Add `partnerId` field to **Client Model** to track which partner added the client

#### 2.2 Client Visibility Rules
- **Partners:** Can only see clients THEY created
- **Admins:** Can see ALL clients (including partner-created clients)
- **Regular Employees:** CANNOT see partner-created clients (unless specifically granted access)

#### 2.3 Client Management by Partners
- Partners can **CREATE** new clients in CRM
- Partners can **EDIT** their own clients
- Partners can **VIEW** their own clients
- Partners CANNOT delete clients (admin-only operation)

#### 2.4 Client Transfer
- Clients CANNOT be transferred between partners
- However, admins can reassign a client's partnerId if needed (edge case)

### 3. Partner-Project Relationship

#### 3.1 Project Ownership
- Add `partnerId` field to **Project Model**
- Projects are linked to BOTH:
  - The client (`clientId`)
  - The partner who created it (`partnerId`)

#### 3.2 Project Visibility Rules
- **Partners:** Can only see projects THEY created
- **Admins:** Can see ALL projects
- **Regular Employees:** Follow existing project permission system (do NOT see partner projects unless assigned)

#### 3.3 Project Management by Partners
- Partners can **CREATE** new projects under their clients
- Partners can **EDIT** their own projects
- Partners can **VIEW** their own projects
- Partners CANNOT delete projects (admin-only operation)

#### 3.4 Project Reassignment
- Admins can change/remove `partnerId` from projects later
- This allows admins to reassign project ownership if a partnership ends

### 4. Partner Permissions & Access Control

#### 4.1 Module Access
Partners should ONLY see these modules:
- **CRM Module** (Leads, Proposals optional; Clients mandatory)
- **Projects Module**

Partners should NOT see:
- Finance
- HRMS (they don't have employee profiles)
- Overall Admin
- Hiring

#### 4.2 Module Permissions in User Model
When a Partner user is created, their `modulePermissions` should be:
```typescript
{
  projectManagement: {
    enabled: true,
    projectPermissions: [] // Dynamic - based on projects they create
  },
  crm: {
    enabled: true,
    subModules: {
      pipeline: false,
      leads: false,
      proposals: false,
      clients: true // Only clients
    }
  },
  finance: { enabled: false },
  hrms: { enabled: false },
  overallAdmin: { enabled: false }
}
```

#### 4.3 Data Filtering Middleware
- Create middleware `filterPartnerData` to:
  - Check if user is a Partner
  - Filter clients by `partnerId`
  - Filter projects by `partnerId`

### 5. Partners Module (Admin View)

#### 5.1 Partners List Page
- Path: `/admin/partners`
- Displays list of all partners with:
  - Partner Name
  - Email
  - Company Name
  - Number of Clients Added
  - Number of Projects Created
  - Status (Active/Inactive)
  - Actions (View, Edit, Deactivate)

#### 5.2 Partner Creation
- Admin can create a new partner
- System generates registration link
- Admin copies link and sends to partner

#### 5.3 Partner Detail View
- Shows partner information
- Lists all clients added by this partner
- Lists all projects created by this partner
- Shows registration status

### 6. Partner Dashboard & UI

#### 6.1 Partner Login
- Partners login through the same `/login` page
- After login, they are redirected to `/dashboard`
- Dashboard shows only 2 modules: CRM and Projects

#### 6.2 Partner Sidebar
- Sidebar should adapt based on role
- For partners, show only:
  - **CRM** > Clients
  - **Projects** > Projects List

#### 6.3 Partner CRM Module
- Path: `/crm/clients`
- Partners can:
  - View list of their clients
  - Add new client
  - Edit their client details
  - View client details

#### 6.4 Partner Projects Module
- Path: `/projects`
- Partners can:
  - View list of their projects
  - Add new project (dropdown shows only their clients)
  - Edit their project details
  - View project details (all tabs)

### 7. Admin Enhancements

#### 7.1 Client Details Enhancement
- In admin's client detail view, show:
  - "Referred By" field displaying partner name (if applicable)
  - Link to partner profile

#### 7.2 Project Details Enhancement
- In admin's project detail view, show:
  - "Created By Partner" field displaying partner name (if applicable)
  - Link to partner profile

#### 7.3 Client/Project List Filters
- Add "Partner" filter in client list
- Add "Partner" filter in project list
- Allows admin to see all clients/projects by a specific partner

#### 7.4 Reporting (Future Enhancement)
- Partner performance metrics
- Revenue by partner
- Client acquisition by partner

## Technical Implementation Notes

### Backend Structure
```
server/src/modules/partners/
├── models/
│   └── Partner.model.ts          # Partner details model
├── controllers/
│   ├── partner.controller.ts     # Partner CRUD operations
│   └── partnerAuth.controller.ts # Partner registration
├── services/
│   ├── partner.service.ts
│   └── partnerAuth.service.ts
├── routes/
│   ├── partner.routes.ts         # Admin routes for partner management
│   └── partnerAuth.routes.ts     # Public partner registration route
├── validators/
│   └── partner.validator.ts
└── middlewares/
    └── filterPartnerData.middleware.ts # Filter data for partners
```

### Frontend Structure
```
client/src/pages/
├── PartnersPage.tsx              # Admin: List all partners
├── PartnerFormPage.tsx           # Admin: Create/Edit partner
├── PartnerDetailPage.tsx         # Admin: View partner details
├── PartnerRegistrationPage.tsx   # Public: Partner registration form
└── PartnerDashboardPage.tsx      # Partner: Custom dashboard (optional)
```

### Database Changes

#### 1. Add Partner Role (in seedRoles.ts)
```typescript
{
  name: 'partner',
  description: 'External partner with limited access',
  permissions: [], // Limited permissions
  level: 6,
}
```

#### 2. Client Model Changes
```typescript
// Add field
partnerId?: Types.ObjectId;  // ref: 'Partner'
```

#### 3. Project Model Changes
```typescript
// Add field
partnerId?: Types.ObjectId;  // ref: 'Partner'
```

#### 4. New Partner Model
```typescript
interface IPartner {
  userId: Types.ObjectId;          // ref: 'User'
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: IAddress;
  registrationToken?: string;
  registrationTokenExpiry?: Date;
  registrationStatus: 'pending' | 'completed';
  registrationSubmittedAt?: Date;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

## User Stories

### Admin Stories
1. As an admin, I want to create partner accounts so external partners can add clients
2. As an admin, I want to see which partner brought in each client
3. As an admin, I want to view all clients and projects created by a specific partner
4. As an admin, I want to deactivate a partner if our partnership ends
5. As an admin, I want to reassign projects from one partner to another (edge case)

### Partner Stories
1. As a partner, I want to register my details via a secure link
2. As a partner, I want to login to CUOS with my credentials
3. As a partner, I want to add new clients I'm working with
4. As a partner, I want to create projects for my clients
5. As a partner, I want to see only my clients and projects (not other partners' data)
6. As a partner, I want to edit client and project details
7. As a partner, I want to view project progress and details

## Success Criteria

✅ Partners can self-register via a secure link
✅ Partners can login and see a dashboard with only CRM and Projects
✅ Partners can CRUD their own clients and projects
✅ Partners cannot see other partners' clients/projects
✅ Partners cannot see employee-only modules (HRMS, Finance, Admin, Hiring)
✅ Admins can manage all partners from a dedicated Partners module
✅ Admins can see which partner created each client/project
✅ Client and Project models track `partnerId`
✅ Regular employees cannot see partner-added data
✅ System maintains data integrity and security

## Future Enhancements (Out of Scope)
- Partner performance analytics dashboard
- Partner commission tracking
- Partner-specific reporting
- Multi-level partner hierarchy (sub-partners)
- Partner notifications for project updates
- Partner revenue sharing calculations

---

**Document Version:** 1.0
**Last Updated:** 2026-03-23
**Status:** Ready for Implementation
