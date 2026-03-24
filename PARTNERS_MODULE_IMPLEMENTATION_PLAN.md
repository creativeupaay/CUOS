# Partners Module - Phase-wise Implementation Plan

## Prerequisites
- ✅ Project uses Node.js + Express + TypeScript + MongoDB (Backend)
- ✅ Project uses React + Vite + TypeScript + Redux Toolkit (Frontend)
- ✅ Existing authentication and role-based access control system
- ✅ Existing CRM and Project Management modules

---

## Phase 1: Database Schema & Backend Foundation

**Objective:** Set up database models and seed data for partners
**Status:** ✅ Verified on 2026-03-23

### Tasks
1. **Add Partner Role to Seed Script**
   - File: `server/src/scripts/seedRoles.ts`
   - Add "partner" role with level 6
   - Define partner permissions (basic CRM + Projects access)
   - Run seed script to create role in database

2. **Create Partner Model**
   - File: `server/src/modules/partners/models/Partner.model.ts`
   - Fields: `userId`, `companyName`, `contactPerson`, `phone`, `email`, `address`, `registrationToken`, `registrationStatus`, `isActive`, `createdBy`
   - Add indexes for performance
   - Include registration token logic

3. **Update Client Model**
   - File: `server/src/modules/client/models/Client.model.ts`
   - Add `partnerId?: Types.ObjectId` field with ref to 'Partner'
   - Add index on `partnerId`

4. **Update Project Model**
   - File: `server/src/modules/project/models/Project.model.ts`
   - Add `partnerId?: Types.ObjectId` field with ref to 'Partner'
   - Add index on `partnerId`

### Deliverables
- ✅ Partner role exists in database
- ✅ Partner model created
- ✅ Client model updated with partnerId
- ✅ Project model updated with partnerId

### Testing
- Run `npm run seed` and verify "partner" role is created
- Check MongoDB to ensure all fields are properly indexed

---

## Phase 2: Partner Backend - CRUD & Authentication

**Objective:** Build backend APIs for partner management and registration
**Status:** ✅ Verified on 2026-03-23

### Tasks
1. **Create Partner Service**
   - File: `server/src/modules/partners/services/partner.service.ts`
   - Functions:
     - `getAllPartners()` - Admin only
     - `getPartnerById(id)`
     - `createPartner(data, createdBy)` - Generate registration token
     - `updatePartner(id, data)`
     - `deactivatePartner(id)`
     - `activatePartner(id)`
     - `getPartnerStats(partnerId)` - Count clients/projects

2. **Create Partner Registration Service**
   - File: `server/src/modules/partners/services/partnerAuth.service.ts`
   - Functions:
     - `validateRegistrationToken(token)`
     - `completePartnerRegistration(token, formData)`
     - `sendRegistrationEmail(partnerId)` (optional)

3. **Create Partner Controllers**
   - File: `server/src/modules/partners/controllers/partner.controller.ts`
   - CRUD operations for partners (admin access)
   - File: `server/src/modules/partners/controllers/partnerAuth.controller.ts`
   - Registration form submission

4. **Create Partner Validators**
   - File: `server/src/modules/partners/validators/partner.validator.ts`
   - Validation schemas using Zod or Joi

5. **Create Partner Middleware**
   - File: `server/src/modules/partners/middlewares/isPartner.middleware.ts`
   - Check if user role is "partner"
   - File: `server/src/modules/partners/middlewares/filterPartnerData.middleware.ts`
   - Filter clients/projects by partnerId for partner users

6. **Create Partner Routes**
   - File: `server/src/modules/partners/routes/partner.routes.ts`
   - Admin routes: GET, POST, PUT, DELETE partners
   - File: `server/src/modules/partners/routes/partnerAuth.routes.ts`
   - Public route: POST `/partner-form/:token` for registration

7. **Register Partner Routes**
   - File: `server/src/routes/v1/index.ts`
   - Add `router.use('/partners', partnerRoutes);`
   - Add `router.use('/partner-form', partnerAuthRoutes);`

### Deliverables
- ✅ Partner CRUD APIs functional
- ✅ Partner registration flow backend complete
- ✅ Partner middleware for data filtering ready

### Testing
- Test partner creation via Postman/Thunder Client
- Test registration token generation and validation
- Test partner registration form submission

---

## Phase 3: Update Client & Project APIs for Partners

**Objective:** Modify existing CRM and Project APIs to support partner data filtering
**Status:** ✅ Implemented on 2026-03-23

### Tasks
1. **Update Client Service**
   - File: `server/src/modules/client/services/client.service.ts`
   - Modify `getAllClients()` to:
     - Accept `partnerId` filter parameter
     - If user is a partner, auto-filter by their partnerId
   - Update `createClient()` to accept `partnerId` and store it

2. **Update Client Controller**
   - File: `server/src/modules/client/controllers/client.controller.ts`
   - Pass partner info from `req.user` to service layer

3. **Update Client Routes**
   - File: `server/src/modules/client/routes/client.routes.ts`
   - Apply `filterPartnerData` middleware for partner users

4. **Update Project Service**
   - File: `server/src/modules/project/services/project.service.ts`
   - Modify `getAllProjects()` to:
     - Accept `partnerId` filter parameter
     - If user is a partner, auto-filter by their partnerId
   - Update `createProject()` to accept `partnerId` and store it

5. **Update Project Controller**
   - File: `server/src/modules/project/controllers/project.controller.ts`
   - Pass partner info from `req.user` to service layer

6. **Update Project Routes**
   - File: `server/src/modules/project/routes/project.routes.ts`
   - Apply `filterPartnerData` middleware for partner users

7. **Update Client Validator**
   - File: `server/src/modules/client/validators/client.validator.ts`
   - Make `partnerId` optional in schemas

8. **Update Project Validator**
   - File: `server/src/modules/project/validators/project.validator.ts`
   - Make `partnerId` optional in schemas

### Deliverables
- ✅ Partners can only see their own clients via API
- ✅ Partners can only see their own projects via API
- ✅ Admins can see all clients/projects with partner info

### Testing
- Test as partner user - should see only own clients/projects
- Test as admin - should see all clients/projects
- Test client creation with partnerId
- Test project creation with partnerId

---

## Phase 4: Frontend - Partners Module (Admin View)

**Objective:** Build admin interface to manage partners
**Status:** ✅ Implemented on 2026-03-23

### Tasks
1. **Create Partners Redux API Slice**
   - File: `client/src/features/partners/partnersApi.ts`
   - RTK Query endpoints:
     - `getPartners`
     - `getPartnerById`
     - `createPartner`
     - `updatePartner`
     - `deactivatePartner`
     - `activatePartner`

2. **Create Partners List Page**
   - File: `client/src/pages/PartnersPage.tsx`
   - Display table of all partners
   - Show stats (clients count, projects count)
   - Add search, filter, sort functionality
   - Actions: View, Edit, Deactivate/Activate

3. **Create Partner Form Page**
   - File: `client/src/pages/PartnerFormPage.tsx`
   - Form to create/edit partner basic info
   - Generate registration link button
   - Copy link to clipboard functionality

4. **Create Partner Detail Page**
   - File: `client/src/pages/PartnerDetailPage.tsx`
   - Display partner information
   - Show tabs:
     - Overview (partner details)
     - Clients (list of clients added by this partner)
     - Projects (list of projects created by this partner)
   - Edit partner button

5. **Add Partners to Overall Admin Sidebar**
   - File: `client/src/components/layout/Sidebar.tsx`
   - Add "Partners" nav item under Admin module
   - Path: `/admin/partners`
   - Icon: Users with handshake or similar

6. **Add Partners Route to App**
   - File: `client/src/App.tsx`
   - Add routes for PartnersPage, PartnerFormPage, PartnerDetailPage

### Deliverables
- ✅ Admin can view list of all partners
- ✅ Admin can create new partners
- ✅ Admin can generate registration links
- ✅ Admin can view partner details with client/project stats

### Testing
- Create a partner as admin
- View partner list
- Generate registration link and copy it
- View partner details

---

## Phase 5: Frontend - Partner Registration Form

**Objective:** Public form for partners to register themselves
**Status:** ✅ Implemented on 2026-03-23

### Tasks
1. **Create Partner Registration API**
   - File: `client/src/features/partners/partnersApi.ts`
   - Add endpoint: `submitPartnerRegistration`
   - Public endpoint (no auth required)

2. **Create Partner Registration Page**
   - File: `client/src/pages/PartnerRegistrationPage.tsx`
   - Similar to EmployeeOnboardingFormPage
   - Form fields:
     - Name (pre-filled from User)
     - Email (pre-filled)
     - Phone
     - Company Name
     - Contact Person
     - Address (street, city, state, country, postal code)
   - Submit button
   - Success/Error states

3. **Add Registration Route to App**
   - File: `client/src/App.tsx`
   - Add public route: `/partner-form/:token`
   - Route: `<Route path="/partner-form/:token" element={loadable(<PartnerRegistrationPage />)} />`

### Deliverables
- ✅ Partners can register via secure link
- ✅ Registration form validates and submits data
- ✅ After registration, partner can login

### Testing
- Use a registration link to access the form
- Fill form and submit
- Verify partner record is created in database
- Try login with partner credentials

---

## Phase 6: Frontend - Partner Dashboard & Navigation

**Objective:** Create partner-specific dashboard and navigation
**Status:** ✅ Implemented on 2026-03-23

### Tasks
1. **Update SuperAdminDashboard**
   - File: `client/src/pages/SuperAdminDashboard.tsx`
   - For partner role, show only CRM and Projects modules
   - Hide other modules for partners

2. **Update Sidebar Component**
   - File: `client/src/components/layout/Sidebar.tsx`
   - Update `getModuleConfig()` function to handle partner role
   - For partners:
     - CRM module shows only "Clients"
     - Projects module shows their projects
   - Hide Finance, HRMS, Admin, Hiring modules

3. **Update Role Detection Logic**
   - Everywhere that checks role (isAdmin, isHrAdmin), add partner role handling
   - Add `isPartner` boolean check

4. **Create Partner Dashboard (Optional)**
   - File: `client/src/pages/PartnerDashboardPage.tsx`
   - Custom dashboard for partners showing:
     - Total clients added
     - Total projects created
     - Recent activity
   - Or, partners can use the same SuperAdminDashboard with filtered modules

### Deliverables
- ✅ Partners see only CRM and Projects on dashboard
- ✅ Sidebar adapts for partner role
- ✅ Partners cannot access restricted modules

### Testing
- Login as partner
- Verify dashboard shows only 2 modules
- Verify sidebar shows only CRM (Clients) and Projects
- Try accessing `/finance`, `/hrms`, `/admin` - should be blocked

---

## Phase 7: Frontend - Partner CRM & Client Management

**Objective:** Enable partners to add and manage their clients
**Status:** ✅ Implemented on 2026-03-23

### Tasks
1. **Update Clients Redux API**
   - File: `client/src/features/clients/clientsApi.ts` (or wherever it exists)
   - Ensure API calls automatically filter by partnerId for partner users

2. **Update ClientsPage**
   - File: `client/src/pages/ClientsPage.tsx`
   - For partners: show only their clients
   - For admins: show all clients with partner filter option
   - Display "Referred By" column for admin view

3. **Update ClientFormPage**
   - File: `client/src/pages/ClientFormPage.tsx`
   - Auto-populate `partnerId` for partner users
   - For partners: hide partner field (auto-set)
   - For admins: show partner dropdown (optional field)

4. **Update ClientDetailPage**
   - File: `client/src/pages/ClientDetailPage.tsx`
   - Display "Referred By Partner" section (admin view)
   - Show partner name with link to partner profile

### Deliverables
- ✅ Partners can view their clients list
- ✅ Partners can add new clients (auto-linked to them)
- ✅ Partners can edit their clients
- ✅ Admins see which partner added each client

### Testing
- Login as partner, add a new client
- Verify client is linked to partner
- Login as different partner, verify they can't see the client
- Login as admin, verify you can see all clients with partner info

---

## Phase 8: Frontend - Partner Project Management

**Objective:** Enable partners to create and manage projects under their clients
**Status:** ✅ Implemented on 2026-03-23

### Tasks
1. **Update Projects Redux API**
   - File: `client/src/features/projects/projectsApi.ts` (or similar)
   - Ensure API calls automatically filter by partnerId for partner users

2. **Update ProjectsPage**
   - File: `client/src/pages/ProjectsPage.tsx`
   - For partners: show only their projects
   - For admins: show all projects with partner filter option
   - Display "Created by Partner" column for admin view

3. **Update ProjectFormPage**
   - File: `client/src/pages/ProjectFormPage.tsx`
   - For partners: Client dropdown shows only their clients
   - Auto-populate `partnerId` for partner users
   - For admins: show partner dropdown (optional field)

4. **Update ProjectDetailPage & Tabs**
   - File: `client/src/pages/ProjectDetailPage.tsx`
   - Display "Partner" section showing partner name (admin view)
   - Link to partner profile page
   - Files: `ProjectOverviewTab.tsx`, `ProjectTasksTab.tsx`, etc.
   - Ensure partners can access all project tabs for their projects

5. **Update Project Access Middleware (Frontend)**
   - Ensure partners can only access their own projects
   - Redirect if they try to access other projects

### Deliverables
- ✅ Partners can view their projects list
- ✅ Partners can add new projects (only under their clients)
- ✅ Partners can edit and view their projects
- ✅ Admins see which partner created each project

### Testing
- Login as partner, create a project under their client
- Verify project is linked to partner and client
- Login as different partner, verify they can't see the project
- Login as admin, verify you can see all projects with partner info
- Test all project tabs (Overview, Tasks, Meetings, etc.) work for partners

---

## Phase 9: Admin Enhancements & Reporting (Optional)

**Objective:** Add admin features to track partner performance
**Status:** ✅ Implemented on 2026-03-23

### Tasks
1. **Add Partner Filters**
   - In ClientsPage: Add partner dropdown filter
   - In ProjectsPage: Add partner dropdown filter

2. **Partner Analytics in Admin Panel**
   - Create a simple stats widget in `PartnersPage`
   - Show: Total clients by partner, Total projects by partner, Active vs Inactive partners

3. **Update Overall Admin Dashboard**
   - File: `client/src/pages/AdminDashboardPage.tsx`
   - Add widget showing partner statistics

4. **Add Partner Column in Lists**
   - ClientsPage: Add "Referred By" column (show partner name)
   - ProjectsPage: Add "Partner" column (show partner name)

### Deliverables
- ✅ Admins can filter clients/projects by partner
- ✅ Basic partner analytics visible
- ✅ Easy to see partner attribution

### Testing
- Filter clients by a specific partner
- Filter projects by a specific partner
- View analytics on partners page

---

## Implementation Order Summary

### Execute in this sequence:
1. **Phase 1** → Database foundation (models + seed)
2. **Phase 2** → Backend APIs (partner CRUD + auth)
3. **Phase 3** → Client/Project API updates (data filtering)
4. **Phase 4** → Admin UI (manage partners)
5. **Phase 5** → Public registration form (partner onboarding)
6. **Phase 6** → Partner navigation (dashboard + sidebar)
7. **Phase 7** → Partner CRM (client management)
8. **Phase 8** → Partner Projects (project management)
9. **Phase 9** → Admin enhancements (optional analytics)

### Rationale for this order:
- **Phases 1-3:** Backend foundation (must be done first)
- **Phase 4:** Admin can create partners (needed before partner login)
- **Phase 5:** Partners can register (needed before partner can work)
- **Phase 6:** Partners can navigate (needed before accessing modules)
- **Phases 7-8:** Partners can work with clients and projects
- **Phase 9:** Polish and admin features

---

## Phase Execution Guidelines

### Before Starting Each Phase:
1. Read the phase objectives carefully
2. Check all files mentioned in the phase
3. Understand the existing code patterns
4. Ask clarifying questions if needed

### During Phase Implementation:
1. Create new files with proper structure
2. Follow existing code patterns (naming, structure, validation)
3. Use TypeScript strict typing
4. Add proper error handling
5. Include validation for all inputs

### After Completing Each Phase:
1. Test all functionality manually
2. Verify no existing features are broken
3. Run build commands: `npm run build` (both client and server)
4. Run linting: `npm run lint`
5. Commit changes with descriptive message

### When to Ask for Help:
- If any file structure differs from expected
- If existing patterns are unclear
- If there are TypeScript errors you can't resolve
- If tests fail and root cause is unclear

---

## Critical Implementation Notes

### 🔒 Security Considerations
- ✅ Partners can ONLY access their own data (enforced by middleware)
- ✅ Partners cannot escalate permissions
- ✅ Registration tokens expire after a set time
- ✅ Partner registration validates all inputs
- ✅ Partners cannot delete clients/projects (read + create + update only)

### 🚀 Performance Considerations
- ✅ Add database indexes on `partnerId` in Client and Project models
- ✅ Use efficient queries (avoid N+1 problems)
- ✅ Paginate partner lists

### 🎨 UI/UX Considerations
- ✅ Partner dashboard is clean and focused (no clutter)
- ✅ Partners see clear visual distinction from regular users
- ✅ Admin can easily identify partner-created records
- ✅ Registration form is intuitive (similar to employee onboarding)

### 🔧 Backward Compatibility
- ✅ Existing clients/projects without `partnerId` still work
- ✅ No breaking changes to existing user/employee flows
- ✅ All existing tests should pass

---

## Rollback Strategy

If issues arise during any phase:
1. **Phase 1-3 (Backend):** Revert database changes, remove new files
2. **Phase 4-8 (Frontend):** Disable routes, revert UI changes
3. **Phase 9 (Optional):** Can be skipped entirely without affecting core functionality

Each phase is designed to be independently testable and revertible.

---

## Success Metrics

After all phases are complete, verify:
- [ ] A new "Partner" role exists in the database
- [ ] Admins can create partners and generate registration links
- [ ] Partners can register via the link
- [ ] Partners can login and see only CRM + Projects
- [ ] Partners can add clients
- [ ] Partners can add projects under their clients
- [ ] Partners can edit their clients and projects
- [ ] Partners cannot see other partners' data
- [ ] Admins can see all partner data with attribution
- [ ] Regular employees cannot see partner-created data
- [ ] All existing functionality remains intact

---

**Document Version:** 1.0
**Last Updated:** 2026-03-23
**Status:** Phases 1-9 Implemented

**Usage Instructions:**
- Execute one phase at a time
- Complete all tasks in a phase before moving to the next
- Test thoroughly after each phase
- Keep this document handy during implementation
