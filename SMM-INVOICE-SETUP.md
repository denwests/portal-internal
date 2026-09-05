# SMM Invoice setup

The Invoice page is available at `/smm-invoice` for Founder and Administrator accounts.

## One-time database setup

1. Open the Supabase SQL Editor for the existing PLUNO Internal project.
2. Run `supabase/smm-invoice.sql`. Run it again when upgrading an older Invoice installation so the Delete permission and policy are added.
3. Reload the portal and open **Social Media Management > Invoice**.
4. Open **Settings** and complete the Vanguena brand, default service, price, project information, and payment details.

The SQL adds only two SMM invoice tables, supporting functions, indexes, triggers, grants, and role-based Row Level Security policies. It does not modify existing booking, finance, gallery, timeline, or social-monitoring data.

## Invoice behavior

- A new invoice uses the active client list from `smm_clients`.
- Invoice IDs are generated as `VGN-YYYYMM-001` and increment safely within the month.
- The invoice is service-neutral and does not require a billing period, so it can cover SMM, product photography, or another Vanguena service.
- Settings are defaults for future invoices.
- Each generated invoice stores a complete snapshot. Updating Settings does not alter old invoices.
- Preview and Download PDF are generated from the stored snapshot.
- Delete asks for confirmation, then permanently removes an incorrect invoice record. Only Founder and Administrator accounts receive this permission.
