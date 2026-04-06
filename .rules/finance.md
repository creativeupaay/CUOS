I want to build a Finance Tracker for my Company.
i will give you idea what you need to take care of and what i want in terms of output, I want you to give me screen by screen description of elements which i will need for this and what exactly that element would be used for, 

eg - 
Dashboard Screen
At top There should be 6 major metrics , Total Revenue , Total Expense, Ebita, Runway Left ,Total Cash in bank, Money in Recievable , then it should have a filter option to choose the Fiscal year on top. Also it could be month wise filter or it could be a range from one date to another as well.

Below that, there should be a chart to show me the Monthly Revenue and expense breakdown in a line graph / bar graph way, In the right side there could be a graph to see Amount of salaries going per month,

Next we can have a Project wise Profitability chart , which can show which project is porfitable currently at what percentage and till which date it will remain profitable.

So Similarly what all screens would be there on this platform, Remember this is only for Finances of the company,
The projects, Team salaries, Team allocation, project management etc are already there present in the platform, this is a new module to be added, so i want this to be focused only on the financial part of the company where a founder can see all the financial health of the company, and assess the metrics.
The data could be fetched from different modules like Client information from CRM, Project Information from project management module, Team allocation from HRMS etc 

Also make sure that we have certain challenges to tackle, 
like we will have GST payments as well, 
we would have international payments as well 
we would have contract value in Foriegn Currency but the amount recieved could be in INR which will have GST deduction.
Also one team member can be allocated to multiple projects, So while calculating the expense of the project, it should consider the amount of time spend on that project within that month and accordingly calculate the salary expense on that project.

Also you should clear your doubts first before start executing creating this document.

and in the output of this, i would require a Screen by Screen Description and specific elements and the action of that element.

2. Absolute Financial Rules
Revenue is never derived from payments
Expenses are never derived from payouts
GST is never income
FX gain/loss is never revenue
Cash balance is never profit
Accrual month and cash month are always separate
Breaking any of these invalidates the system.

3. Accrual vs Cash Discipline
Every transaction must store:
Accrual month
Cash month (if applicable)
Never overwrite one with the other.

4. Multi-Currency Rules
DO
Store foreign amount and INR separately
Lock FX rate at payment time
Sum INR from stored values only

NEVER
Convert using today’s FX rate
Re-evaluate historical data
Guess FX values

If FX data is missing:
Block aggregation
Ask user explicitly

5. GST Rules
DO
Treat GST as liability
Track output and input separately
Show GST payable even if unpaid

NEVER
Include GST in revenue
Include GST cash in runway
Offset GST silently


6. Project & Revenue Rules
No revenue without a project
No invoice without a project
No payment without project mapping
Revenue follows delivery, not billing

7. TDS Rules
DO
Track TDS at booking time
TDS is always calculated on base amount (without GST)
TDS is not calculated for foriegn currency transactions

8. Salaries, Contractors & TDS Rules
Salaries accrue monthly, always
Contractor TDS tracked at booking time
Net payout ≠ expense amount
Never “remember TDS later”