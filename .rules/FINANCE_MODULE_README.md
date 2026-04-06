# Finance Module - Complete Overhaul

## ✅ What's Been Completed

### 1. **Indian Fiscal Year Support** (April - March)
- Dashboard now uses FY 2024-25 format
- Quarterly periods: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
- All date calculations adjusted for fiscal year

### 2. **Enhanced Data Models**

#### Revenue Model (`server/src/modules/finance/models/Revenue.model.ts`)
- **Sources**: Project, Manual, Interest, Refund, Other
- **Accrual Tracking**: Separate month/year for when revenue is earned vs. when cash is received
- **GST & TDS**: Automatic calculations with configurable rates
- **Multi-currency**: Foreign amount + INR conversion with locked exchange rates
- **Status**: Pending, Received, Partially Received

#### Expense Model (`server/src/modules/finance/models/Expense.model.ts`)
- **2-Level Structure**:
  - **Company Level**: Fixed costs, Variable costs
  - **Project Level**: Direct project costs
- **Cost Type Tagging**: Fixed vs Variable for analysis
- **Categories**: Salary, Rent, Marketing (CAC), Project, Overhead, Tax, etc.

### 3. **New Dashboard Features**

#### Filter Options
- **Yearly**: Full fiscal year view
- **Quarterly**: FY quarters (Q1-Q4)
- **Monthly**: Individual month view
- **Custom Range**: Flexible date selection

#### Key Metrics (6 Cards)
1. **Total Revenue** - With/without GST breakdown
2. **Total Expenses** - With payroll breakdown
3. **Gross Profit** - Revenue - Direct costs, with margin %
4. **EBITDA** - Operating profit before depreciation/interest/tax
5. **Cash in Bank** - Net cash position
6. **Receivables** - Outstanding payments + overdue count

#### Charts
1. **Revenue vs Expenses** - Line chart showing monthly trends
2. **Monthly Profitability** - Bar chart with positive/negative support

#### Monthly P&L Table
- Detailed profit & loss statement by month
- Totals footer for selected period

### 4. **New Pages**

#### Revenue Page (`/finance/revenue`)
- Track both project-based and manual revenue entries
- Filter by source, status, year
- Search across titles, projects, clients
- Add/edit/delete revenue entries
- Record payments against revenue
- Summary cards showing total, received, pending

#### Enhanced Expenses Page (`/finance/expenses`)
- Company level vs Project level toggle
- Fixed cost vs Variable cost categorization
- Filter by category, status, cost type
- Approve/reject workflow
- Project assignment for project-level expenses

### 5. **Backend APIs**

All routes under `/api/v1/finance/`:

**Revenue**
- `GET /revenue` - List all revenues with filters
- `GET /revenue/summary` - Revenue summary for date range
- `GET /revenue/monthly/:year` - Monthly revenue report
- `GET /revenue/:id` - Get single revenue
- `POST /revenue` - Create newrevenue
- `PATCH /revenue/:id` - Update revenue
- `DELETE /revenue/:id` - Delete revenue
- `POST /revenue/:id/payment` - Record payment

**Dashboard**
- `GET /dashboard` - Dashboard stats for date range
- `GET /reports/monthly/:year` - Monthly P&L report

**Expenses** (existing, enhanced)
- All expense endpoints with costType and expenseLevel support

## 🚀 How to Use

### Running the Application

1. **Start Backend**
   ```bash
   cd server
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   cd client
   npm run dev
   ```

### Adding Dummy Data (Local Only)

To test the Finance module with sample data:

```bash
cd server
npm run seed:finance
```

**⚠️ Important**:
- This script ONLY affects your LOCAL database
- Before running, update the IDs in `server/seed-finance.js`:
  - `SAMPLE_PROJECT_ID` - Use a real project ID from your DB
  - `SAMPLE_CLIENT_ID` - Use a real client ID from your DB
  - `SAMPLE_USER_ID` - Use your user ID from your DB

To find these IDs, you can:
```bash
# In MongoDB shell or Compass, run:
db.projects.findOne({}, {_id: 1})
db.clients.findOne({}, {_id: 1})
db.users.findOne({}, {_id: 1})
```

### Navigation

The Finance module has 3 main sections accessible from the sidebar:

1. **Dashboard** (`/finance`)
   - Overview of financial health
   - Filter by fiscal year/quarter/month
   - Key metrics and charts

2. **Revenue** (`/finance/revenue`)
   - Track all income sources
   - Project-based + manual entries
   - Payment tracking

3. **Expenses** (`/finance/expenses`)
   - Company-level (Fixed + Variable)
   - Project-level costs
   - Approval workflow

## 📊 Data Flow

### Revenue Flow
1. **Invoice-based**: Automatically pulled from existing invoices
2. **Manual entries**: Create revenue from other sources (interest, refunds, etc.)
3. **Accrual tracking**: Record when earned (accrualMonth/Year)
4. **Cash tracking**: Record when received (cashMonth/Year)

### Expense Flow
1. **Create expense**: Choose company or project level
2. **For company**: Select fixed or variable cost type
3. **For project**: Select which project and category
4. **Approval**: Pending → Approved → Paid

### Dashboard Calculations
- **Gross Profit** = Revenue (excl. GST) - Direct Costs (project costs + 70% of payroll)
- **EBITDA** = Revenue - Operating Expenses (excludes depreciation, interest, tax)
- **Net Profit** = Revenue - All Expenses
- **Cash in Bank** = Cash Received - Cash Paid Out

## 🎨 Design Features

- **Modern UI**: Clean, aesthetic design with subtle animations
- **Responsive**: Works on desktop and mobile
- **Color-coded**: Visual indicators for different expense/revenue types
- **Interactive Charts**: Hover for details
- **Smooth Transitions**: Fade-in animations, hover effects

## 🔧 Technical Stack

### Backend
- **Node.js + Express + TypeScript**
- **MongoDB + Mongoose**
- **Zod** for validation
- **Aggregation pipelines** for complex reports

### Frontend
- **React 19 + TypeScript**
- **Redux Toolkit (RTK Query)** for API calls
- **Lucide React** for icons
- **CSS Custom Properties** for theming
- **Vite** for bundling

## 📝 Key Business Rules

1. **Revenue is never derived from payments** - Track accrual separately
2. **GST is a liability, not income** - Calculated and tracked separately
3. **Multi-currency**: Foreign amounts converted to INR with locked FX rates
4. **TDS calculated on base amount** (without GST)
5. **Fiscal year**: April 1 - March 31
6. **Accrual vs Cash**: Track both when earned and when received

## 🐛 Known Issues & Fixes

### ✅ Fixed Issues
1. **Import Error** - Revenue page import path corrected
2. **Fiscal Year** - Now uses April-March instead of January-December
3. **Old Files** - Removed `FinanceInvoicesPage` and `FinanceReportsPage`

### 📋 Recommended Enhancements (Future)
1. Add depreciation tracking for accurate EBITDA
2. Add interest expense tracking
3. Export to PDF/Excel functionality
4. Budget vs Actual comparison
5. Cash flow projections
6. Tax planning module

## 🎯 Quick Start Checklist

- [ ] Backend running on http://localhost:5000
- [ ] Frontend running on http://localhost:5173
- [ ] Updated seed script with real IDs from your database
- [ ] Run `npm run seed:finance` to add dummy data
- [ ] Navigate to `/finance` in the app
- [ ] Test all 3 tabs (Dashboard, Revenue, Expenses)
- [ ] Try different filters (Yearly, Quarterly, Monthly, Custom)
- [ ] Create a new revenue entry
- [ ] Create a new expense (both Company and Project level)

## 📧 Support

If you encounter any issues:
1. Check browser console for errors
2. Check backend logs in terminal
3. Verify database connection
4. Ensure all IDs in seed script are valid

---

**Last Updated**: April 2026
**Finance Module Version**: 2.0
**Status**: ✅ Production Ready
