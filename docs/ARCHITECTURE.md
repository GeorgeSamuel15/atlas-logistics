# Architecture

## Repository layout

| Directory | Responsibility |
| --- | --- |
| apps/web/src/pages | React route screens for each domain |
| apps/web/src/lib.tsx | Typed HTTP client, CSRF token handling and interface primitives |
| apps/api/src/modules | Authentication, shipments, operations, finance, support and administration |
| apps/api/src/db.ts | SQLite connection, versioned schema and atomic transaction helper |
| apps/api/src/core.ts | Permissions, hashing, scoped reads, audit, notifications and shared server helpers |
| packages/shared/src | Roles, statuses, domain types and Zod booking validation |
| apps/api/tests | Isolated workflow integration tests |
| tests/browser | Browser smoke and responsive checks |

The architecture is a modular monolith. One backend owns transactional consistency for related records. A monorepo shares TypeScript domain definitions and validation across application boundaries. The browser uses same-origin REST requests; Vite proxies `/api` locally, while the built API serves the frontend itself.

## Storage

Schema version 1 has users, sessions, settings, rates, vehicles, maintenance, hubs, shipments, events, locations, invoices, payments, routes, stops, custody, scans, tickets, messages, notifications and audit tables. Foreign keys, unique payment references, unique tracking codes, constrained roles/statuses and route stop uniqueness protect key relationships. WAL mode, a busy timeout and indexes support local operation. Money is stored as integer cents; timestamps use ISO UTC strings.

Booking inserts the shipment, quote snapshot, invoice, first event, notification and audit record atomically. Status changes and invoice settlement also use transactions. Shipment mutation requests carry a version, rejecting outdated browser forms. The synchronous database connection serializes local operations; it must not be mistaken for cross-region concurrency support.

## Shipment lifecycle

BOOKED → ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED.

Failures are permitted after pickup, during transit or out for delivery. FAILED may be retried through the assignment endpoint or marked RETURNED. BOOKED/ASSIGNED may be cancelled by authorized operations staff; customers can cancel only BOOKED. Paid shipments cannot be cancelled. Cancellation voids the unpaid invoice. Warehouse custody must be departed before OUT_FOR_DELIVERY or a terminal state.

Completed shipments retain financial and delivery history. A return does not automatically refund delivery fees. A failed shipment continues to reserve vehicle capacity until retried or returned.

## Security model

Passwords use salted scrypt. The browser receives an opaque session token in an HttpOnly, SameSite=Lax cookie; only its SHA-256 digest is stored in the database. Production cookies are Secure. Sessions expire after eight hours and are revoked on password change, account deactivation or logout. Mutation requests require a per-session CSRF token. Origin validation also protects browser mutations and authentication endpoints.

Every protected endpoint checks the current user and active status. Customer-owned and driver-assigned reads are scoped server-side, including direct detail URLs. Public tracking returns no names, phone numbers, street addresses, GPS locations or free-text event notes. Tracking tokens have 64 bits of random entropy and the endpoint is rate-limited. Login and registration are rate-limited per process/IP.

There is no MFA, email verification or password-reset email delivery in this release. Audit records are append-only through the exposed API, but not cryptographically tamper-evident. The process owner can modify the local database. Memory-based rate limiting is suitable for one process only.

## Frontend

Role-specific navigation is a convenience; authorization remains on the server. Shared request helpers include CSRF automatically and show API validation messages. Routes use loading/empty/error states, responsive layouts and accessible field labels. Data refreshes after successful mutations or explicit refresh. There is no WebSocket transport or silent location collection.

## Scale-up boundary

Before a multi-company or high-volume launch, add tenant IDs and tenant-scoped unique constraints; move SQL repositories to PostgreSQL and asynchronous transactions; introduce a migration framework, pooled connections, pagination across every administrative list, a background job/outbox system, distributed rate limiting, monitoring, backups and recovery drills. External payment providers need verified signed webhooks and idempotent settlement. Map providers need geocoding and road-network routing, separate from the current manual-coordinate quote and delivery-stop heuristic.

Do not split into microservices merely to increase repository size: preserve the booking/invoice/notification transaction or replace it with an explicit outbox and reconciliation process.

Primary implementation references: https://nodejs.org/api/sqlite.html and https://expressjs.com/en/advanced/best-practice-security.html.
