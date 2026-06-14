Financial Management & Pricing Logic Guideline

1. Overview
This document defines the core financial and mathematical logic for the company's operating system. It covers client project pricing, multi-currency handling, tax applications (GST), and tax deductions (TDS).
All financial calculations must ultimately be normalized to the base currency: INR (₹).
2. Core Entities & Variables

2.1. Inputs Required per Project/Milestone
When a new project or milestone is created, the system must capture the following variables:

* Currency: The currency of the client/project (e.g., INR, USD, AED).
* Entered_Price: The raw price agreed upon (Fixed or Milestone).
* FX_Rate: Live exchange rate to convert Currency to INR (Default is 1 if currency is INR).
* GST_Applicable (Boolean): Yes/No.
* GST_Type (Enum): Exclusive (Added on top of price) or Inclusive (Included within the price). Default is 18%.
* TDS_Applicable (Boolean): Yes/No.
* TDS_Type (Enum): Percentage (e.g., 2%, 10%) or Fixed_Amount.

2.2. Calculated System Outputs
The system must generate the following standard financial metrics for every transaction:

* True_Revenue: The actual business revenue (excluding taxes).
* GST_Payable: The tax amount owed to the government.
* Total_Invoice_Value: The total amount billed to the client.
* TDS_Amount: The tax deducted at source by the client.
* Amount_Received: The actual cash the client will send/transfer.
* Money_In_Bank: The final net cash retained by the agency after paying GST.

3. Calculation Engine (Step-by-Step Logic)

Step 1: Currency Normalization
Convert the inputted price to INR using the live exchange rate.
Converted_Price_INR = Entered_Price * FX_Rate

Step 2: Revenue and GST Calculation
The system must determine the actual revenue and the GST based on the GST_Type. (Note: GST is assumed to be 18%)

Scenario A: GST Applicable AND GST_Type == "Exclusive"
True_Revenue = Converted_Price_INR
GST_Payable = True_Revenue * 0.18
Total_Invoice_Value = True_Revenue + GST_Payable

Scenario B: GST Applicable AND GST_Type == "Inclusive"
True_Revenue = Converted_Price_INR / 1.18
GST_Payable = Converted_Price_INR - True_Revenue
Total_Invoice_Value = Converted_Price_INR

Scenario C: GST NOT Applicable
True_Revenue = Converted_Price_INR
GST_Payable = 0
Total_Invoice_Value = Converted_Price_INR

Step 3: TDS (Tax Deducted at Source) Calculation
Important Rule: TDS is ALWAYS calculated on the True_Revenue (the base price), NOT on the total invoice value with GST.

If TDS_Applicable == true:
If TDS_Type == "Percentage":
TDS_Amount = True_Revenue * (TDS_Percentage / 100)
If TDS_Type == "Fixed_Amount":
TDS_Amount = Entered_TDS_Amount * FX_Rate (Convert fixed TDS to INR if it was inputted in foreign currency)
Else:
TDS_Amount = 0

Step 4: Final Cash Flow Calculations
Amount_Received = Total_Invoice_Value - TDS_Amount
Money_In_Bank = Amount_Received - GST_Payable

4. Expected Test Cases
To validate the code, developers must run the following test cases to ensure the math perfectly aligns with agency expectations.

Test Case 1: Domestic Project (GST Exclusive + TDS)
Inputs: Entered_Price: 100, Currency: INR, FX_Rate: 1, GST_Applicable: Yes, GST_Type: Exclusive, TDS_Applicable: Yes, TDS_Type: 10%.
Execution:

* Converted_Price_INR = 100
* True_Revenue = 100
* GST_Payable = 18 (18% of 100)
* Total_Invoice_Value = 118 (100 + 18)
* TDS_Amount = 10 (10% of True_Revenue 100)
* Amount_Received = 108 (118 - 10)
* Money_In_Bank = 90 (108 - 18)

Test Case 2: Foreign Project (GST Inclusive, No TDS)
Inputs: Entered_Price: 100, Currency: USD, FX_Rate: 95.11, GST_Applicable: Yes, GST_Type: Inclusive, TDS_Applicable: No.
Execution:

* Converted_Price_INR = 9511
* True_Revenue = 8060.16 (9511 / 1.18)
* GST_Payable = 1450.83 (9511 - 8060.16)
* Total_Invoice_Value = 9511
* TDS_Amount = 0
* Amount_Received = 9511
* Money_In_Bank = 8060.16 (9511 - 1450.83)

Test Case 3: Foreign Project (No GST, No TDS)
Inputs: Entered_Price: 100, Currency: USD, FX_Rate: 95.11, GST_Applicable: No, TDS_Applicable: No.
Execution:

* Converted_Price_INR = 9511
* True_Revenue = 9511
* GST_Payable = 0
* Total_Invoice_Value = 9511
* TDS_Amount = 0
* Amount_Received = 9511
* Money_In_Bank = 9511 (9511 - 0)