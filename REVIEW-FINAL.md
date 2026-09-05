# Final source review - 2026-09-04

## Scope

Reviewed the redesign working copy based on commit 6abb6ee. No commit, push, deployment, database mutation, or change to the user's main checkout was performed.

## Corrections

- Calendar picker safely falls back when showPicker is unavailable or blocked by an embedded browser.
- Month values and compact transaction dates are validated; invalid values produce safe placeholders.
- Gallery preview generation no longer uses an async Promise executor; bitmap resources are closed in finally and error causes are retained.
- Chart keyboard targets now expose month/value labels.
- Added four UI helper tests and a root test command that also runs existing social-structure tests.
- Added environment-file and temporary-directory exclusions to .gitignore.
- Replaced the starter README with project-specific installation instructions.

## Cleanup

Removed unused App.css, pluno-redesign.css, uiEnhancements.js, the duplicate unused src/lib/supabase.js, public/icons.svg, and the unused React/Vite/hero assets. Removed hidden moon/atmosphere decoration markup/styles. Removed the sample PDF generator and generated PDF/temp output from the application source delivery.

These files were checked for references in the runtime entrypoints and source before removal. A separate PLUNO-pre-cleanup-backup.zip is retained alongside the delivery, and earlier ZIP versions are unchanged. Existing SQL, Worker, tests, setup documentation, and active theme/page styles remain.

## Validation

- npm ls --depth=0: dependencies resolve, including Inter.
- Production build: passed.
- Root tests: 12 passed (finance periods, social structure, and UI formatting).
- Worker tests: 3 passed.
- git diff --check: passed.
- Lint: 8 errors and 5 warnings remain in existing React hook/state patterns; the async Promise executor error was fixed. Lint rules were not disabled.
- Build retains a large-bundle warning. Code splitting is a separate optimization.
- No fresh full browser/mobile E2E or authenticated live-data verification was performed in this final cleanup pass. Existing visual checks are recorded in the handoff.

## Suggested commit

Subject:

```text
feat(ui): redesign PLUNO portal and harden interface helpers
```

Reason/body:

```text
Unify the internal portal and shared pages with a compact dark design,
bundled Inter typography, readable status states, and consistent exports.
Improve dashboard hierarchy, financial summary layout, and date controls.
Harden calendar and image-preview handling and add regression tests.
Remove unused starter assets, duplicate modules, and generated QA files
while preserving existing stored data, roles, and finance semantics.

Validation: production build, 12 root tests, and 3 Worker tests pass.
Known follow-up: existing React-hook lint findings and mobile/live-data QA.
```

## Apply before committing

Back up your current checkout and review local edits first. Extract this package without overwriting .git or private environment files. Remove the obsolete source paths listed above from the destination too if overlay-copying the archive, since extraction does not delete old files. Run npm ci, build, and tests, inspect git diff, then commit only the intended source changes. The ZIP contains no node_modules, dist, private secrets, or Git metadata.

## SMM Invoice update - 2026-09-05

- Added the protected **Social Media Management > Invoice** page below Timeline.
- Added configurable Vanguena title, service, price, information, and payment defaults without a parent-brand label or mandatory billing period.
- Added invoice generation from active SMM clients, immutable invoice snapshots, generated timestamps, preview, and PDF download.
- Added responsive desktop-table and mobile-card layouts with dark neutral panels and no decorative logo, yellow accent, or gradient.
- Added `supabase/smm-invoice.sql` with monthly invoice numbering, indexes, explicit grants, and Founder/Administrator RLS policies.
- Added an invoice regression suite. Root tests now pass 24/24 and Worker tests pass 3/3.
- Production build and targeted lint for all Invoice integration files pass. Full source lint still reports five pre-existing React effect findings in ClientGallery, Employee, GalleryManager, Spending, and Transactions; no lint rule was disabled.

Suggested commit:

```text
feat(smm): add invoice generator and PDF archive
```

Reason:

```text
Add a protected SMM invoice workspace with reusable defaults, active-client
selection, immutable invoice history, monthly invoice IDs, and a consistent
print-ready Vanguena PDF. Include responsive layouts, role-based Supabase RLS,
setup guidance, and regression coverage without changing existing portal data.
```

## Dashboard calendar update - 2026-09-05

- Replaced booking text blocks inside calendar cells with compact booking dots.
- Kept every date cell at a consistent height so busy dates no longer stretch the calendar grid.
- Limited interaction to dates containing bookings and retained keyboard-accessible opening behavior.
- Reused the existing overlay for the selected day's booking list, now with booking count, time, package, and detail view.
- Added compact desktop and mobile sizing plus regression coverage for the dot-and-overlay behavior.

Suggested commit:

```text
feat(dashboard): redesign booking calendar with day indicators
```

### Booking detail polish

- Changed Customer, Package, Time, Status, and Description values to high-contrast white.
- Standardized the four information cards to equal 90px rows, 12px gaps, and identical internal padding.
- Aligned the Description card and Back action to the same content width and spacing system.
- Preserved a single-column mobile layout with consistent minimum card heights.

## Alignment, navigation, contrast, and invoice deletion - 2026-09-05

- Stretched the two lower Dashboard columns to one shared height so Monthly Revenue and Booking Schedule finish on the same bottom edge on desktop.
- Removed Client Gallery and Social Media from the sidebar only. Their routes and stored data remain intact to avoid destructive changes.
- Applied high-contrast white text throughout the Spending and Bookkeeping interfaces while keeping PDF/print output ink-friendly.
- Added a red, compact Delete action to generated invoices with an explicit confirmation dialog and immediate list/summary refresh.
- Extended `supabase/smm-invoice.sql` with the explicit DELETE grant and Founder/Administrator RLS policy. Existing installations must run this SQL file again.
- Validation: production build passed, targeted lint passed, 29 root tests passed, 3 Worker tests passed, and `git diff --check` passed.

Suggested commit:

```text
fix(ui): align dashboard and add safe invoice deletion
```

Reason:

```text
Align the Dashboard lower cards, simplify sidebar navigation, and improve
financial-page text contrast. Add confirmed invoice deletion with an explicit
Supabase grant and role-based RLS policy while preserving hidden routes and
all existing client, social, and financial data.
```
