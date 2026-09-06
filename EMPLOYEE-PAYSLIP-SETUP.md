# Employee Payslip setup

1. Open the Supabase SQL Editor for PLUNO Internal.
2. Run `supabase/employee-payslips.sql` once.
3. Deploy the updated portal and sign in as Founder.
4. Open **Management > Employee Payslips**.

Only active Founder accounts can read, generate, and delete payslips. Each record stores a salary snapshot, so later employee profile changes do not rewrite an existing slip.

The form supports PLUNO STUDIO and VANGUENA, automatic net-pay calculation, optional overtime/incentive/other-income details, PDF preview/download, and confirmed deletion. Removing an employee account keeps historical payslips while clearing only the employee relation.
