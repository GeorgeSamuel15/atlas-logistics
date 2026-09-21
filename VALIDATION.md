# Validation report

## September 17 update — verified

- Added saved light/dark preference on sign-in, the signed-in workspace and public tracking.
- Replaced the below-table invoice panel with a dedicated invoice route, loading/error/retry states, payment history and back navigation.
- Added `npm run fresh-start`: credential validation, a complete SQLite backup, atomic demo-data removal and administrator creation. It refuses to reset databases with non-demo accounts.
- Updated production frontend/backend build and strict type checks passed.
- All 14 API tests passed, including two new fresh-start tests proving backup preservation, removal of demo login access, successful new-admin login, refusal to reset real accounts and no mutation on invalid credentials.
- A real browser check passed dark-mode persistence after reload, administrator login, View invoice navigation, recording a payment, invoice reload, mobile-width overflow check and switching back to light mode. Desktop and mobile screenshots were inspected.
- No user database on the user's laptop was modified here; the user runs the new setup command locally.
- The original broader browser-suite limits below describe the initial release; this update verified the specific invoice/theme workflows listed above.

## Initial release verification

Build environment: Node.js 24.19.0. This report records executed checks, not guarantees about every possible deployment or workload.

## Passed

- Dependency installation completed with the included lockfile.
- Strict TypeScript checks passed for backend, shared types, frontend and API test sources.
- The Vite production frontend build passed (approximately 338 kB JavaScript before compression).
- Backend TypeScript compilation passed; the compiled server started and served the built frontend.
- Explicit demo setup created 30 synthetic shipments and the documented accounts.
- All 12 API integration tests passed against fresh in-memory SQL databases:
  1. Booking, assignment, delivery proof and exact invoice settlement.
  2. Customer/driver isolation and sanitized public tracking.
  3. CSRF, foreign-origin rejection and logout revocation.
  4. Stale-version rejection and invalid lifecycle transitions.
  5. Vehicle capacity and incompatible driver/vehicle assignments.
  6. Warehouse custody, duplicate scans and departure prerequisites.
  7. Partial payments, duplicate references, overpayment prevention and paid-cancellation rejection.
  8. Unpaid cancellation and invoice voiding in one transaction.
  9. Route ownership, duplicate-route rejection, failed-delivery retry and route completion.
  10. Ticket ownership, staff replies, notifications and closed-ticket behavior.
  11. Password/session revocation, account deactivation and active-driver protection.
  12. Immutable existing quotes after rate changes and invalid booking inputs.
- A real Chromium browser run signed in as administrator, displayed the dashboard and navigated the 13 main admin module screens. A desktop screenshot is included at `docs/previews/overview.png` and was visually inspected.

## Browser testing limitation

The first browser run stopped at an exact-label selector on the customer dropdown during booking. Explicit accessible labels were added to all shared form controls and the production build passed again. Subsequent browser launches failed inside the supplied browser runtime with SIGSEGV. The standard Playwright browser download had also timed out.

Consequently, the browser booking-to-delivery workflow and mobile viewport checks are **not verified as passed**. Browser tests are included in `tests/browser/workspace.spec.ts` so they can be run with a normal local Playwright Chromium installation. The equivalent delivery workflow did pass through real HTTP API integration tests. Do not interpret the included screenshot as proof of end-to-end UI completion.

## Corrections made during verification

- Fixed a route-stop insert with the wrong number of SQL placeholders.
- Required failed-delivery retries to use assignment validation rather than a direct status change.
- Preserved route driver/vehicle ownership while allowing a failed stop to retry on the same route.
- Blocked out-for-delivery status while a parcel remains in hub custody.
- Added explicit accessible labels to shared form controls.
- Switched CLI TypeScript execution to Node's `--import tsx` form for broader runtime compatibility.

## Not executed / not claimed

- Docker image build or container run; Docker configuration is supplied for local use.
- GitHub Actions execution; its workflow is supplied.
- Public hosting/deployment, external payment processing, SMTP/SMS, continuous GPS tracking or native mobile delivery.
- Load testing, external security audit, automated backup restoration or PostgreSQL migration.
- A guarantee of zero defects or commercial production readiness.

React Router's `use client` directive produces a benign Vite build warning; the client-only React bundle completes successfully. The platform is a substantial single-operator development application with documented integration and scale boundaries.

## September 18 origin regression

Build and typecheck passed. All 15 API tests passed, including actual sign-in from localhost/127.0.0.1 port 5174 with stale APP_ORIGINS, whitespace handling, rejection of foreign/lookalike origins, and production explicit-only origins. No user database was changed.
