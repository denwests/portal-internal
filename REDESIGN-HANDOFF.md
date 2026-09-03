# PLUNO Internal Portal - Monochrome Redesign V4

Baseline: `denwests/portal-internal` main, commit `6abb6ee`.

Final cleanup and current verification results are recorded in REVIEW-FINAL.md. Validation notes below describe the earlier design iterations. Generated sample PDFs are not part of the cleaned source package.

## What changed

- Unified dark, compact monochrome design system for internal and public-facing pages.
- Removed the moon symbol and all yellow or gradient accents.
- Rebuilt sidebar identity, active states, and navigation iconography.
- Redesigned sign-in and password recovery experience.
- Added a responsive grayscale SVG revenue trend chart with prior-year comparison, hatched area, legend, and tooltip.
- Restyled cards, tables, filters, forms, overlays, states, and mobile navigation with firmer geometry and stronger text contrast.
- Fixed the Spending panels, headings, table surfaces, and empty-state contrast.
- Consolidated month and year controls into calendar-based period pickers, with separate date and year modes where required.
- Rebalanced the content timeline columns, multi-select controls, and empty states.
- Removed dialog entrance transitions so Add actions open directly as lightweight overlays.
- Standardized customer, transaction, invoice, spending, bookkeeping, and SMM timeline PDF output with one grayscale header, table, and footer system.
- Aligned shared timeline, privacy, and client gallery destinations with the internal visual language.

## V4 corrections

- Dashboard now starts directly with Studio Performance.
- Standardized panel/form spacing and mobile grid rules.
- Colored status accents retain dark surfaces.
- Transaction table dates use DD/MM/YYYY. Cash MDR is below Payment Transactions; Net Cash Received is beside Cash Received on desktop.
- Fixed Customer detail text and Bookkeeping Customer Final Value surfaces.
- Build and six tests pass. Existing lint remains at 9 errors and 5 warnings.
- Responsive CSS updated; no fresh mobile visual check performed for V4.

## Typography

Inter is now bundled through `@fontsource/inter` (Latin weights 400, 500, and 600), so the browser does not depend on a locally installed font or Google Fonts request. Inter is a close visual match; the exact original typeface cannot be confirmed from the reference image alone.

## V3 corrections

- Dark gray selected, focused, and hovered controls and table rows; legacy white search and hover backgrounds are overridden.
- High-contrast white section headings, including Booking Payments.
- Firm 6px-radius payment and status badges, with English display labels while preserving existing stored status values.
- Bookkeeping PDF labels corrected to QRIS Revenue and Non-QRIS Revenue.
- Copy-link notifications use a compact dark panel, English text, and a separate accessible dismiss button.
- Verified a populated Booking row and its hover state, Transactions heading, notification layout, and actual Inter font loading.
- Temporary visual-test fixtures and authentication preview were removed; unauthenticated Dashboard navigation redirects to Login.

## Replace and run

1. Back up the current project and environment file.
2. Replace the project source with this package.
3. Restore the existing environment values or deployment secrets. Do not commit them.
4. Run `npm ci`.
5. Run `npm run build -- --configLoader runner`.

## Validation

- Production build: passed.
- Revenue-period tests: passed (3/3).
- Worker adapter tests: passed (3/3).
- Desktop visual checks for Spending, Add overlay, Timeline, and Dashboard: passed.
- Responsive rules are retained for tablet and mobile layouts; production compilation passed.
- Standard PDF sample was rendered to PNG and visually checked: passed.
- Existing repository lint baseline remains at 9 errors and 5 warnings; the redesign did not add a new lint finding.

The delivery archive intentionally excludes `.git`, `node_modules`, generated `dist`, caches, and private environment files.
