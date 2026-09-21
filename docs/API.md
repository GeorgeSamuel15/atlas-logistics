# API inventory

Base URL `/api`. JSON responses return an object or array. Errors have `{ "error": "message" }` and an appropriate HTTP status. Authentication returns `{ user, csrf }`; save the cookie and send `x-csrf-token` on subsequent protected mutations. There are no bearer tokens in browser storage.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /health | Health check |
| GET | /track/:tracking | Sanitized public tracking |
| POST | /auth/register | Customer registration |
| POST | /auth/login | Sign in; sets session cookie |
| GET | /auth/me | Current user and CSRF token |
| POST | /auth/logout | Revoke current session |
| POST | /auth/password | Change password and revoke all sessions |
| GET | /dashboard | Role-scoped metrics |
| GET | /shipments?search=&status=&page=&limit= | Scoped paginated shipments, max 100 per page |
| POST | /shipments/quote | Price the validated booking payload |
| POST | /shipments | Create booking and invoice |
| GET | /shipments/:id | Details, events, latest location, custody and quote |
| POST | /shipments/:id/assign | driverId, vehicleId, version |
| POST | /shipments/:id/status | status, version, note, recipientName for delivery |
| POST | /shipments/:id/location | lat, lng, accuracy; assigned driver only |
| GET/POST | /fleet | List/create vehicles |
| PATCH | /fleet/:id | Update vehicle details |
| GET/POST | /fleet/:id/maintenance | Service history / record service |
| GET/POST | /hubs | List/create hubs |
| GET/POST | /hubs/scans | Recent scans / record RECEIVE or DEPART |
| GET/POST | /routes | Scoped list / create manifest |
| GET | /routes/:id | Route and ordered shipment stops |
| POST | /routes/:id/status | ACTIVE or COMPLETED |
| GET | /invoices | Scoped invoice list with derived paid totals |
| GET | /invoices/:id | Invoice and payment records |
| POST | /invoices/:id/payments | Integer amount in cents, unique reference, method |
| GET/POST | /tickets | Scoped list / new ticket |
| GET | /tickets/:id | Ticket and messages |
| POST | /tickets/:id/messages | Add body to conversation |
| PATCH | /tickets/:id | Staff status and priority update |
| GET | /users?role= | Role-restricted directory |
| POST | /users | Admin creates an account |
| PATCH | /users/:id | Admin sets active boolean |
| GET | /notifications | Own inbox and unread count |
| POST | /notifications/read | Mark own inbox read |
| GET/PATCH | /admin/settings | Company name and support email |
| GET | /admin/rates | Rate cards |
| PATCH | /admin/rates/:service | Rate card values |
| GET | /admin/audit?limit= | Latest audit rows; max 200 |
| GET | /reports?from=YYYY-MM-DD&to=YYYY-MM-DD | Period report |
| GET | /reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD | CSV download |

## Example booking

```json
{
  "pickup": {"address":"10 Queen Street","city":"London","lat":51.5,"lng":-0.12},
  "delivery": {"address":"25 Park Road","city":"London","lat":51.53,"lng":-0.15},
  "recipientName":"Avery Smith",
  "recipientPhone":"+447700900555",
  "weight":3,"length":20,"width":20,"height":20,
  "declaredValue":10000,
  "service":"STANDARD",
  "pickupAt":"2030-01-01T12:00:00.000Z",
  "notes":"Call reception."
}
```

Choose an actual future pickup time. Staff bookings also require `customerId`; the server ignores it for customer-owned booking identity. Shared Zod schemas are in `packages/shared/src/index.ts`. Integration tests are executable examples for authentication and the full lifecycle.

`price`, `declaredValue`, payment amounts and rate components are integer cents. Dimensions are centimetres, weight kilograms, GPS decimal degrees and accuracy metres. Service multipliers apply to base, distance and weight fees; declared-value cover adds 1%. Geographic distance is a quote estimate, not an asserted driven distance.
