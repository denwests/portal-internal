# Spending Four-Panel Setup

The Spending page now contains four separate monthly wallets:

1. **Studio Expenses** — operational expenses included in Bookkeeping.
2. **Cash Spending** — cash movement, kept outside Bookkeeping expenses.
3. **Attire / Background** — a separate monthly wallet for wardrobe and backdrop allocation.
4. **Evoto Balance** — a separate credit wallet with Credit In, Credit Out, balance, and automatic Rupiah conversion.

Attire / Background and Evoto are intentionally excluded from Bookkeeping because they use separate wallets.

## Database update

Before entering the two new categories, open the Supabase SQL Editor and run:

`supabase/spending-four-panels.sql`

The migration preserves existing records, adds the new fields, creates one protected Evoto rate setting, and limits that setting to active Founder and Administrator accounts. It is safe to run again.

## Evoto workflow

1. Open **Spending** and select **Evoto Balance**.
2. Select the gear button and enter the Rupiah value of one credit.
3. Add an **In** entry when credits are added to the wallet.
4. Add an **Out** entry when credits are used.

Credit quantities accept decimals such as `0,5`, `1,5`, and `2,5`. The transaction value is calculated from `credits × saved credit rate`. Each transaction stores the rate used at that time, so older records retain their historical value after the setting changes.
