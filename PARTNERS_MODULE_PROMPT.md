# Partners Module - Implementation Prompt (For New Chat)

Use this prompt to start a fresh implementation session:

---

## Context

I'm working on **CUOS** (Creative Upaay Operating System) - a full-stack ERP system built with:
- **Backend:** Node.js + Express + TypeScript + MongoDB
- **Frontend:** React + Vite + TypeScript + Redux Toolkit (RTK Query) + TailwindCSS

## Current System
The system has **6 existing modules:**
1. Project Management - Manage projects, tasks, time logs, meetings, credentials, documents
2. Finance - Track expenses, invoices, financial reports
3. CRM - Customer relationship management (pipeline, leads, proposals, clients)
4. HRMS - Human resource management and employee records
5. Overall Admin - System administration, users, permissions, roles, audit logs
6. Hiring - Job postings, applications, assignments, interviews

There's also a **Client Portal** (part of CRM) where clients can view their projects.

Users have **roles** (super-admin, admin, manager, finance, hr, employee) with granular permissions.

## The New Requirement: Partners Module

### What are Partners?
**Partners are external collaborators** (not employees) who refer/bring clients to our company. They act as intermediaries and need limited access to:
- Add clients to our CRM
- Create projects under those clients
- Manage only their own clients and projects

### Key Requirements

#### 1. Partner User & Role
- Create a new role **"Partner"** in the system (level 6)
- Partners should appear in **Overall Admin > Users** (they are CUOS users)
- Partners have a dedicated **Partners Module** for management (admin only)
- Partners are NOT employees (no Employee record in HRMS)

#### 2. Partner Registration Flow
- Admin creates a partner in the system
- System generates a **registration token/link** (like employee onboarding)
- Admin sends link to partner
- Partner fills a **public registration form** with their details (name, email, phone, company, address)
- After submission, partner can login to CUOS

#### 3. Partner-Client Relationship
- Partners can **add clients** in CRM
- Clients are **owned by the company**, NOT by the partner (partners are just referrers)
- Add `partnerId` field to **Client Model** to track which partner added the client
- **Visibility Rules:**
  - Partners: Can only see clients THEY created
  - Admins: Can see ALL clients (including partner-created ones)
  - Regular Employees: CANNOT see partner-created clients
- Partners can **create, edit, and view** their clients (cannot delete)

#### 4. Partner-Project Relationship
- Partners can **create projects** under their clients
- Add `partnerId` field to **Project Model** to track which partner created the project
- Projects are linked to both `clientId` and `partnerId`
- **Visibility Rules:**
  - Partners: Can only see projects THEY created
  - Admins: Can see ALL projects
  - Regular Employees: Follow existing project permission system (cannot see partner projects)
- Partners can **create, edit, and view** their projects (cannot delete)
- Admins can reassign/remove `partnerId` from projects later if needed

#### 5. Partner Module Access
Partners should ONLY see these modules when logged in:
- ✅ **CRM** (only "Clients" sub-module)
- ✅ **Projects** (all sub-modules for their projects)

Partners should NOT see:
- ❌ Finance
- ❌ HRMS (they don't have employee profiles)
- ❌ Overall Admin
- ❌ Hiring

#### 6. Admin Features
- **Partners List Page** (`/admin/partners`):
  - View all partners with stats (clients count, projects count)
  - Create new partner (generates registration link)
  - Edit/Deactivate/Activate partners
- **Partner Detail Page**:
  - View partner info
  - List all clients added by this partner
  - List all projects created by this partner
- **Client/Project Lists**:
  - Show "Referred By" or "Partner" column
  - Add partner filter dropdown
  - Click partner name to see their profile

## Implementation Phases

Execute in this order (one phase at a time):

### Phase 1: Database Schema & Backend Foundation
- Add Partner role to seed script
- Create Partner model
- Update Client model (add `partnerId` field)
- Update Project model (add `partnerId` field)

### Phase 2: Partner Backend - CRUD & Authentication
- Create partner services (CRUD operations)
- Create partner registration service (token validation, form submission)
- Create partner controllers
- Create partner routes (admin + public registration)
- Create partner middleware (isPartner, filterPartnerData)

### Phase 3: Update Client & Project APIs for Partners
- Update client service to filter by partnerId for partners
- Update project service to filter by partnerId for partners
- Apply middleware to client/project routes
- Ensure admins still see all data

### Phase 4: Frontend - Partners Module (Admin View)
- Create partners Redux API slice
- Create PartnersPage (list all partners)
- Create PartnerFormPage (create/edit partner)
- Create PartnerDetailPage (view partner with clients/projects)
- Add Partners nav item in Admin sidebar
- Add routes to App.tsx

### Phase 5: Frontend - Partner Registration Form
- Create partner registration API endpoint (frontend)
- Create PartnerRegistrationPage (public form)
- Add public route `/partner-form/:token`

### Phase 6: Frontend - Partner Dashboard & Navigation
- Update SuperAdminDashboard to show only CRM + Projects for partners
- Update Sidebar to filter modules for partner role
- Add role detection logic for partners

### Phase 7: Frontend - Partner CRM & Client Management
- Update ClientsPage to filter by partnerId for partners
- Update ClientFormPage to auto-populate partnerId for partners
- Update ClientDetailPage to show partner info (admin view)

### Phase 8: Frontend - Partner Project Management
- Update ProjectsPage to filter by partnerId for partners
- Update ProjectFormPage to show only partner's clients and auto-populate partnerId
- Update ProjectDetailPage to show partner info (admin view)

### Phase 9: Admin Enhancements & Reporting (Optional)
- Add partner filters in client/project lists
- Add partner analytics/stats
- Add partner performance reporting

## Important Implementation Notes

### Security
- Partners can ONLY access their own data (middleware enforced)
- Partners cannot delete anything (read + create + update only)
- Registration tokens must expire
- Partners cannot escalate permissions

### Backward Compatibility
- Existing clients/projects (without partnerId) still work normally
- No breaking changes to existing flows
- All existing tests must pass

### Code Patterns to Follow
- Follow existing module structure (models, controllers, services, routes, validators)
- Use existing middleware patterns (authenticate, checkPermission)
- Follow existing validation patterns (Zod/Joi)
- Use RTK Query for all API calls (frontend)
- Follow existing component patterns (tables, forms, layouts)

## When You're Ready to Start

**Say:** "I'm ready to start implementation. Let's begin with **Phase 1: Database Schema & Backend Foundation**"

Then I'll execute each phase one by one, testing after each phase before moving to the next.

---

## Quick Reference Files

### Key Backend Files to Understand:
- `server/src/modules/auth/models/User.model.ts` - User model with modulePermissions
- `server/src/modules/auth/models/Role.model.ts` - Role model
- `server/src/modules/client/models/Client.model.ts` - Client model
- `server/src/modules/project/models/Project.model.ts` - Project model
- `server/src/scripts/seedRoles.ts` - Seed script for roles
- `server/src/routes/v1/index.ts` - Main route registration

### Key Frontend Files to Understand:
- `client/src/App.tsx` - Main routing
- `client/src/pages/SuperAdminDashboard.tsx` - Dashboard showing all modules
- `client/src/components/layout/Sidebar.tsx` - Dynamic sidebar based on role
- `client/src/pages/AdminUsersPage.tsx` - Reference for user management UI
- `client/src/pages/EmployeeOnboardingFormPage.tsx` - Reference for registration form pattern

---

**Ready to implement? Start with Phase 1!**
