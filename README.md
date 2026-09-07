# PLUNO Internal Portal

React/Vite portal for studio bookings, customer data, finance, galleries, and social content.

## Spending wallets

Spending uses four compact monthly panels: Studio Expenses, Cash Spending, Attire / Background, and Evoto Balance. Run `supabase/spending-four-panels.sql` before using the two new wallets. See `SPENDING-FOUR-PANELS-SETUP.md` for the workflow and deliberate Bookkeeping separation.

## Install and run

Run `npm ci` after replacing source files. This installs the bundled Inter font dependency as well.

```text
npm ci
npm run dev
npm run build -- --configLoader runner
npm test
npm test --prefix worker
npm run lint
```

## Configuration and safety

Keep your existing environment configuration and Worker secrets outside source control. Never replace the project's existing `.git` directory with a delivery archive. Do not run database scripts merely to install a UI update.

## Review and integration

See `REVIEW-FINAL.md` for review findings, validation limits, removed files, and the suggested commit message. See `REDESIGN-HANDOFF.md` for design history and `SOCIAL-MEDIA-SETUP.md` for integration setup.

For the Social Media Management invoice generator, run the one-time database setup described in `SMM-INVOICE-SETUP.md`.

For the Founder-only Employee Payslips generator, run the one-time database setup described in `EMPLOYEE-PAYSLIP-SETUP.md`.
