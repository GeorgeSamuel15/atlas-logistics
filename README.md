# Atlas Logistics

**Update:** Dark mode, a dedicated invoice page, and `npm run fresh-start` for replacing the demo workspace with your own administrator are included. Read `UPDATE_GUIDE.md` before updating an existing installation.

A substantial full-stack TypeScript logistics platform with six permissioned roles and a persistent SQL database. Includes operations, customer booking, dispatch, driver delivery workflows, route manifests, fleet maintenance, warehouse custody, invoices, support, notifications, reporting and administration.

This is a runnable single-operator application, not a static dashboard. It is designed for local evaluation and further development; it is not a claim of enterprise production readiness.

## Quick start — Windows, macOS or Linux

Install **Node.js 24 or newer**. Extract this ZIP, open the `atlas-logistics` folder in VS Code, then choose **Terminal → New Terminal**. Run these commands one at a time:

```sh
npm ci
npm run setup
npm run dev
```

Open **http://localhost:5173**. Keep the terminal open. `npm run dev` starts both the API and web app; you do not need separate terminals.

The API is on port 4000. Data is stored in `apps/api/data/atlas.sqlite`. Restarting the app does not erase it. Seeding is explicit and does nothing if users already exist. No database installation, API key, crypto wallet or paid service is required.

## Demo sign-ins

All demo accounts use the password **`AtlasDemo!2026`**.

| Role | Email | Main responsibilities |
| --- | --- | --- |
| Admin | admin@atlas.demo | Entire workspace, team, pricing, audit |
| Dispatcher | dispatch@atlas.demo | Booking, assignment, routes, fleet, support |
| Warehouse | warehouse@atlas.demo | Shipment visibility and hub custody scans |
| Finance | finance@atlas.demo | Invoices, payment records, reports, customer directory |
| Driver | driver@atlas.demo | Own assigned deliveries, routes, location submission |
| Customer | customer@atlas.demo | Own bookings, tracking, invoices, support |

Additional isolation/demo accounts: `driver2@atlas.demo` and `customer2@atlas.demo`, with the same demo password. The seed contains 30 synthetic shipments, four vehicles, three hubs, invoices and a support conversation. Demo addresses, histories and payment records are fictional.

## What is implemented

- Customer registration, login, logout, password change, revocable sessions and role-based access.
- Customer and driver record isolation enforced by the API.
- Booking with parcel dimensions, volumetric weight, coordinates, service tiers, server-calculated rates and immutable quote snapshots.
- Shipment list with search, filters and pagination; shipment details, timeline and printable detail/label view.
- Driver/vehicle assignment with capacity and availability checks; optimistic version checks prevent stale updates.
- Pickup → transit → out for delivery → recipient-name delivery proof; failed delivery, dispatch-authorized retry, return and cancellation rules.
- Driver-initiated geolocation submission and links to external navigation/maps. No fabricated location data.
- Route manifests with explicit stop order or a nearest-neighbour delivery-stop heuristic.
- Fleet directory, vehicle editing, service dates and maintenance records.
- Hub directory, capacity, receive/depart scans and custody history.
- Automatic invoices, partial payments, unique payment references, balance calculation and printable invoices.
- Customer/staff directories, staff creation, account activation and session invalidation.
- Support tickets, replies, priorities and staff resolution.
- Persistent in-app notifications, unread counts and mark-all-read.
- Dashboard metrics, date-filtered reports, formula-safe CSV export, company settings, rate cards and audit log.
- Public tracking with unpredictable tracking numbers and sanitized event history.

## Try the whole delivery workflow

1. Sign in as **customer**. Select **New shipment**.
2. Enter a recipient, pickup/delivery addresses and coordinates. For a short demo trip use pickup `51.5074, -0.1278` and delivery `51.539, -0.143`.
3. Enter parcel size, weight, a future pickup time and service. Calculate a quote, then create the shipment.
4. Copy its tracking number. Sign out and sign in as **dispatcher**. Find it in **Dispatch board**, open it, and assign **Sam Rivera** with **ATL-204**.
5. Sign in as **driver**. Open the assigned shipment and advance to **Picked up**, **In transit**, and **Out for delivery**. Submit **Delivered** with a recipient name.
6. Sign in as **finance**, open its invoice, and record a payment with a unique reference. The invoice becomes paid when payments equal its total.
7. Sign in as **customer** again to see the delivery history and payment status. Public tracking works without an account.

For warehouse handling, receive the parcel after pickup/in transit, then depart it from the same hub before marking it out for delivery. For route planning, first assign shipments to the same driver and vehicle, then select them in **Routes & manifests**. A failed delivery on a route can be retried with the same driver and vehicle, or returned; complete all stops before completing the route.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install exact dependencies from the lockfile |
| `npm run setup` | Create schema and demo records, if the database is empty |
| `npm run dev` | Start both API and Vite with reload |
| `npm run typecheck` | Strict checks for frontend, backend and shared types |
| `npm test` | Run isolated in-memory API integration tests |
| `npm run build` | Type check and build frontend and backend |
| `npm start` | Serve the built application at http://localhost:4000 |
| `npm run test:browser` | Run Playwright checks after installing its browser |

For a built local run:

```sh
npm run build
npm start
```

Open **http://localhost:4000**. Run commands through the root scripts so the API uses the correct working directory.

For browser tests, install Chromium first:

```sh
npx playwright install chromium
npm run test:browser
```

## Configuration

Defaults work locally. Optional environment variables are documented in `.env.example`. The server does not automatically load that file: set variables in your shell or hosting environment. Example in PowerShell:

```powershell
$env:PORT="4000"
$env:DB_PATH="C:\atlas-data\atlas.sqlite"
npm start
```

For public deployment, use HTTPS, set `NODE_ENV=production`, set `APP_ORIGINS` to the exact public origin, and use persistent storage. Production cookies require HTTPS. Do not deploy demo accounts or synthetic records as live customer data. See `docs/DEPLOYMENT.md` for bootstrap and Docker details.

## Scope boundaries

This release serves **one logistics organisation with multiple hubs**, not independent SaaS tenants. The driver experience is a responsive web workspace, not a native Android/iOS app.

Coordinates are entered manually; distance pricing is straight-line distance. Route ordering does not model roads, traffic, time windows or pickup precedence. Drivers share a location explicitly; there is no continuous background GPS or live map subscription. Refresh to retrieve the latest shared location.

Payments are ledger entries for money received elsewhere, not card processing. Notifications are in-app only. Proof of delivery stores the recipient name and driver note, not a photograph or handwritten signature. Label/invoice printing uses the browser print dialog, not a carrier-certified barcode label. Support for returns records delivery state; it does not create a separate reverse-logistics booking or automated financial refund.

SQLite provides an easy persistent local setup. It is a synchronous, single-instance storage choice, not a distributed high-volume production architecture. Administrative lists and route selection have deliberate bounds noted in the interface. See `docs/ARCHITECTURE.md` for the scale-up boundary and `VALIDATION.md` for exactly what was verified.

## Files to read

- `BUILD_PROMPT.md` — the prompt executed to build this project
- `docs/ARCHITECTURE.md` — structure, database, workflows and technical boundaries
- `docs/API.md` — endpoint inventory and request conventions
- `docs/ROLE_MATRIX.md` — permissions by role
- `docs/DEPLOYMENT.md` — local build, bootstrap, Docker and deployment guidance
- `VALIDATION.md` — actual verification outcomes

## Troubleshooting

- `node:sqlite` unavailable: install Node 24+, close the terminal, reopen it and check `node -v`.
- Unable to sign in: run `npm run setup`; use the demo email exactly. Setup does not reset existing passwords.
- Port already in use: stop another app using 4000/5173, or configure the API port and update the Vite proxy together.
- Assignment rejected: check driver activity, vehicle availability, assigned load and open route ownership.
- Cannot finish delivery: depart warehouse custody first and supply a recipient name.
- Cannot cancel: only an unassigned customer booking can be customer-cancelled; payments block cancellation pending finance review.
- Cannot start browser tests: install the Playwright Chromium browser. API tests and application startup do not require it.
