# PLUNO Internal Portal

React/Vite portal for studio bookings, customer data, finance, galleries, and social content.

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
