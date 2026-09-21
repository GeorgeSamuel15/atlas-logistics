# Atlas Logistics — executable build brief

Build a substantial, downloadable TypeScript logistics and delivery platform. Implement the application now; do not stop at a proposal or static dashboard. Use a modular monorepo, real persistent database, server-side permissions and working interfaces. Package the prompt, source, lockfile, automated tests, deployment instructions and honest validation report.

## Product scope
One logistics operator with multiple hubs, employees, drivers and customer accounts. Provide six roles: ADMIN, DISPATCHER, WAREHOUSE, FINANCE, DRIVER, CUSTOMER. Customer and driver queries must be scoped on the server. A driver sees assigned jobs only; a customer sees owned records only. No client-side role switching that bypasses authentication.

1. Authentication: customer registration, hashed passwords, opaque revocable cookie sessions, CSRF protection, throttled login, logout, password change and admin user activation controls.
2. Operations overview: database-derived KPIs, shipment statuses, service mix, recent activity, overdue deliveries, driver availability and outstanding balances.
3. Shipment booking: pickup/delivery addresses and coordinates, recipient contact, parcel weight, dimensions, declared value, service tier, notes and pickup date. Server-calculated quotes with rate breakdown; save pricing snapshot with shipment and generate invoice atomically.
4. Shipment management: searchable and filterable paginated list, detail page, timeline, controlled lifecycle, cancellation rules and printable label. Never expose recipients or street addresses in public tracking.
5. Dispatch: assign active drivers and available vehicles, validate capacity, prevent incompatible vehicle assignments, handle reassignments, preserve audit history.
6. Driver workspace: assigned deliveries, pickup and transit actions, explicit browser location submission, delivery failure reason, retry, recipient-name proof of delivery and handoff to external navigation. Do not fabricate GPS positions or silently collect location.
7. Routes: create dated driver/vehicle manifests, select compatible shipments, order stops, optional nearest-neighbour ordering using supplied coordinates, save route and print manifest. Explain straight-line heuristic limits.
8. Fleet: vehicles, capacity, availability, odometer, maintenance log and service dates. Block active-vehicle maintenance and conflicting dispatch.
9. Hubs and warehouse: hub directory, capacity checks, receive/depart scans, custody history, prevent duplicate receives and invalid departures.
10. Customers and staff: directory, create staff users, activation controls and customer account summaries. Protect last administrator.
11. Finance: invoices, partial/manual payment records, outstanding balances, duplicate payment reference protection, customer invoice access and printable invoices. Do not label recorded payments as processed card charges.
12. Support: customer-owned tickets, messages, priority and staff resolution.
13. Notifications: persistent per-user inbox, unread counts and mark-as-read. In-app only unless a real provider is configured.
14. Administration: rate cards, company settings, server-recorded audit log and role restrictions.
15. Reports: date-filtered shipment and revenue summaries, safe CSV export. No made-up business metrics.
16. Public tracking: unguessable tracking token with status and sanitized timeline only.

## Technical and interface requirements
React + TypeScript responsive web interface, Node.js + Express TypeScript API, shared Zod validation, SQL database with constraints and versioned schema, transactions for dependent writes, integer minor units for money, and UTC timestamps. Use a persistent SQLite database for a no-service local setup; document single-instance limits and the PostgreSQL migration boundary. Include deterministic synthetic demo data and six documented demo accounts. Require explicit seeding; do not recreate demo accounts in production startup.

Design a polished navy/blue operations workspace with side navigation, accessible forms, meaningful empty/loading/error states, mobile driver layout, real tables and charts. Every visible action must work or explain its prerequisite. Do not advertise placeholders as finished capabilities.

## Verification and delivery
Run strict type checking, production build, API integration tests covering permissions and the delivery lifecycle, and browser tests where available. Check booking → dispatch → pickup → transit → delivery → invoice settlement; failed delivery and retry; customer isolation; warehouse custody; route conflicts; CSRF/session revocation; payment invariants. Fix discovered failures. Provide README, architecture, API inventory, role matrix, validation results, Docker/CI setup, and demo walkthrough. Clearly separate implemented features from public deployment, native mobile applications, paid routing/maps, payment gateways, email/SMS, and other future integrations.
