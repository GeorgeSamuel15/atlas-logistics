import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { openDb, one } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';
import type { Shipment } from '../../../packages/shared/src/index.js';
const booking = () => ({ pickup: { address: '10 Queen Street, London', city: 'London', lat: 51.5, lng: -.12 }, delivery: { address: '25 Park Road, London', city: 'London', lat: 51.53, lng: -.15 }, recipientName: 'Test Recipient', recipientPhone: '+447700900555', weight: 3, length: 20, width: 20, height: 20, declaredValue: 10000, service: 'STANDARD', pickupAt: new Date(Date.now() + 3600000).toISOString(), notes: 'Ring the reception bell.' });
async function setup() { const db = openDb(':memory:'); seed(db); const app = createApp(db); async function login(name: string) { const agent = request.agent(app); const res = await agent.post('/api/auth/login').send({ email: name + '@atlas.demo', password: 'AtlasDemo!2026' }).expect(200); return { get: (url: string) => agent.get('/api' + url), post: (url: string, body: object) => agent.post('/api' + url).set('x-csrf-token', res.body.csrf).send(body), patch: (url: string, body: object) => agent.patch('/api' + url).set('x-csrf-token', res.body.csrf).send(body), agent, csrf: res.body.csrf }; } const customer = await login('customer'), dispatch = await login('dispatch'), driver = await login('driver'); async function book() { return (await customer.post('/shipments', booking()).expect(201)).body as Shipment; } async function get(s: Shipment) { return (await customer.get('/shipments/' + s.id).expect(200)).body.shipment as Shipment; } async function assign(s: Shipment) { await dispatch.post(`/shipments/${s.id}/assign`, { driverId: 'driver', vehicleId: 'van1', version: s.version }).expect(200); return get(s); } async function status(s: Shipment, value: string, extra = {}) { await driver.post(`/shipments/${s.id}/status`, { status: value, version: s.version, ...extra }).expect(200); return get(s); } return { db, app, login, customer, dispatch, driver, book, get, assign, status }; }
test('booking → assignment → delivery proof → exact invoice settlement', async () => { const f = await setup(); try {
    let s = await f.book();
    const quote = (await f.customer.post('/shipments/quote', booking()).expect(200)).body;
    assert.equal(s.price, quote.amount);
    s = await f.assign(s);
    for (const next of ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'])
        s = await f.status(s, next);
    await f.driver.post(`/shipments/${s.id}/status`, { status: 'DELIVERED', version: s.version }).expect(400);
    s = await f.status(s, 'DELIVERED', { recipientName: 'Avery Smith', note: 'Reception signed for parcel.' });
    assert.equal(s.proof_name, 'Avery Smith');
    const finance = await f.login('finance');
    const inv = (await finance.get('/invoices').expect(200)).body.find((i: {
        shipment_id: string;
    }) => i.shipment_id === s.id);
    await finance.post(`/invoices/${inv.id}/payments`, { amount: inv.amount, reference: 'TEST-FULL-001', method: 'BANK_TRANSFER' }).expect(201);
    const result = await finance.get('/invoices/' + inv.id).expect(200);
    assert.equal(result.body.invoice.status, 'PAID');
    assert.equal(result.body.invoice.paid, inv.amount);
}
finally {
    f.db.close();
} });
test('customer and driver isolation; public tracking removes private fields', async () => { const f = await setup(); try {
    const s = await f.book();
    const other = await f.login('customer2');
    await other.get('/shipments/' + s.id).expect(404);
    await f.driver.get('/shipments/' + s.id).expect(404);
    const inv = one<{
        id: string;
    }>(f.db, 'SELECT id FROM invoices WHERE shipment_id=?', s.id)!;
    await other.get('/invoices/' + inv.id).expect(404);
    const tracking = await request(f.app).get('/api/track/' + s.tracking).expect(200);
    assert.equal(tracking.body.recipient_name, undefined);
    assert.equal(tracking.body.pickup_address, undefined);
    assert.equal(tracking.body.events[0].note, undefined);
    await f.customer.get('/admin/audit').expect(403);
    await f.customer.get('/fleet').expect(403);
}
finally {
    f.db.close();
} });
test('CSRF, origin rejection and session revocation', async () => { const f = await setup(); try {
    await f.customer.agent.post('/api/shipments').send(booking()).expect(403);
    await request(f.app).post('/api/auth/login').set('Origin', 'https://attacker.example').send({ email: 'admin@atlas.demo', password: 'AtlasDemo!2026' }).expect(403);
    await f.customer.post('/auth/logout', {}).expect(200);
    await f.customer.get('/auth/me').expect(401);
}
finally {
    f.db.close();
} });
test('stale versions and lifecycle skipping are rejected', async () => { const f = await setup(); try {
    let s = await f.book();
    await f.dispatch.post(`/shipments/${s.id}/status`, { status: 'DELIVERED', version: s.version, recipientName: 'Someone' }).expect(409);
    const old = s.version;
    s = await f.assign(s);
    await f.driver.post(`/shipments/${s.id}/status`, { status: 'PICKED_UP', version: old }).expect(409);
    await f.customer.post(`/shipments/${s.id}/status`, { status: 'CANCELLED', version: s.version, note: 'Changed my mind' }).expect(403);
}
finally {
    f.db.close();
} });
test('capacity and conflicting driver assignments are enforced', async () => { const f = await setup(); try {
    const s = (await f.customer.post('/shipments', { ...booking(), weight: 3000 }).expect(201)).body;
    await f.dispatch.post(`/shipments/${s.id}/assign`, { driverId: 'driver', vehicleId: 'van1', version: s.version }).expect(400);
    const small = await f.book();
    await f.dispatch.post(`/shipments/${small.id}/assign`, { driverId: 'driver', vehicleId: 'van2', version: small.version }).expect(400);
    await f.dispatch.post(`/shipments/${small.id}/assign`, { driverId: 'driver', vehicleId: 'van3', version: small.version }).expect(400);
}
finally {
    f.db.close();
} });
test('warehouse custody prevents duplicate receive and delivery departure bypass', async () => { const f = await setup(); try {
    let s = await f.assign(await f.book());
    s = await f.status(s, 'PICKED_UP');
    const warehouse = await f.login('warehouse');
    await warehouse.post('/hubs/scans', { tracking: s.tracking, hubId: 'hub1', action: 'RECEIVE' }).expect(201);
    await warehouse.post('/hubs/scans', { tracking: s.tracking, hubId: 'hub1', action: 'RECEIVE' }).expect(409);
    await warehouse.post('/hubs/scans', { tracking: s.tracking, hubId: 'hub2', action: 'DEPART' }).expect(409);
    s = await f.status(s, 'IN_TRANSIT');
    await f.driver.post(`/shipments/${s.id}/status`, { status: 'OUT_FOR_DELIVERY', version: s.version }).expect(400);
    await warehouse.post('/hubs/scans', { tracking: s.tracking, hubId: 'hub1', action: 'DEPART' }).expect(201);
    await f.status(s, 'OUT_FOR_DELIVERY');
}
finally {
    f.db.close();
} });
test('partial payments reject overpayment and duplicate references; paid booking cannot cancel', async () => { const f = await setup(); try {
    const s = await f.book(), finance = await f.login('finance');
    const inv = one<{
        id: string;
        amount: number;
    }>(f.db, 'SELECT * FROM invoices WHERE shipment_id=?', s.id)!;
    await finance.post(`/invoices/${inv.id}/payments`, { amount: 100, reference: 'PARTIAL-01', method: 'CASH' }).expect(201);
    await finance.post(`/invoices/${inv.id}/payments`, { amount: 100, reference: 'PARTIAL-01', method: 'CASH' }).expect(409);
    await finance.post(`/invoices/${inv.id}/payments`, { amount: inv.amount, reference: 'OVER-01', method: 'CASH' }).expect(400);
    await f.customer.post(`/shipments/${s.id}/status`, { status: 'CANCELLED', version: s.version, note: 'No longer needed' }).expect(400);
    assert.equal((await finance.get('/invoices/' + inv.id)).body.invoice.paid, 100);
}
finally {
    f.db.close();
} });
test('unpaid cancellation voids invoice atomically', async () => { const f = await setup(); try {
    const s = await f.book();
    await f.customer.post(`/shipments/${s.id}/status`, { status: 'CANCELLED', version: s.version, note: 'Booked by mistake' }).expect(200);
    assert.equal(one<{
        status: string;
    }>(f.db, 'SELECT status FROM invoices WHERE shipment_id=?', s.id)!.status, 'VOID');
    assert.equal((await f.get(s)).status, 'CANCELLED');
}
finally {
    f.db.close();
} });
test('routes enforce assignments, reject duplicates, and support a failed-delivery retry', async () => { const f = await setup(); try {
    let s = await f.assign(await f.book());
    const payload = { name: 'Test round', driverId: 'driver', vehicleId: 'van1', date: '2026-09-20', shipmentIds: [s.id], optimize: true };
    const route = await f.dispatch.post('/routes', payload).expect(201);
    await f.dispatch.post('/routes', { ...payload, date: '2026-09-21' }).expect(400);
    await f.driver.post('/routes/' + route.body.id + '/status', { status: 'ACTIVE' }).expect(200);
    await f.driver.post('/routes/' + route.body.id + '/status', { status: 'COMPLETED' }).expect(400);
    s = await f.status(s, 'PICKED_UP');
    s = await f.status(s, 'FAILED', { note: 'Recipient unavailable' });
    await f.dispatch.post(`/shipments/${s.id}/status`, { status: 'ASSIGNED', version: s.version }).expect(400);
    s = await f.assign(s);
    for (const next of ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'])
        s = await f.status(s, next);
    await f.status(s, 'DELIVERED', { recipientName: 'Avery Smith' });
    await f.driver.post('/routes/' + route.body.id + '/status', { status: 'COMPLETED' }).expect(200);
}
finally {
    f.db.close();
} });
test('ticket conversations are scoped and closed tickets reject messages', async () => { const f = await setup(); try {
    const t = await f.customer.post('/tickets', { subject: 'Parcel instructions', body: 'Please call reception on arrival.', priority: 'NORMAL' }).expect(201);
    const other = await f.login('customer2');
    await other.get('/tickets/' + t.body.id).expect(404);
    await f.dispatch.post('/tickets/' + t.body.id + '/messages', { body: 'Noted, thank you.' }).expect(201);
    await f.dispatch.patch('/tickets/' + t.body.id, { status: 'CLOSED', priority: 'NORMAL' }).expect(200);
    await f.customer.post('/tickets/' + t.body.id + '/messages', { body: 'Hello again' }).expect(400);
    const notifications = await f.customer.get('/notifications').expect(200);
    assert.ok(notifications.body.unread > 0);
}
finally {
    f.db.close();
} });
test('password changes invalidate all sessions and inactive users cannot sign in', async () => { const f = await setup(); try {
    const second = await f.login('customer');
    await f.customer.post('/auth/password', { current: 'AtlasDemo!2026', password: 'Replacement!2026' }).expect(200);
    await second.get('/auth/me').expect(401);
    const admin = await f.login('admin');
    await admin.patch('/users/customer2', { active: false }).expect(200);
    await request(f.app).post('/api/auth/login').send({ email: 'customer2@atlas.demo', password: 'AtlasDemo!2026' }).expect(401);
    await admin.patch('/users/driver', { active: false }).expect(400);
}
finally {
    f.db.close();
} });
test('future rate changes do not modify existing shipment pricing', async () => { const f = await setup(); try {
    const s = await f.book(), admin = await f.login('admin');
    await admin.patch('/admin/rates/STANDARD', { base: 9999, per_km: 100, per_kg: 100, multiplier: 2, sla_hours: 48 }).expect(200);
    assert.equal((await f.get(s)).price, s.price);
    const q = await f.customer.post('/shipments/quote', booking()).expect(200);
    assert.ok(q.body.amount > s.price);
    await f.customer.post('/shipments', { ...booking(), weight: -1 }).expect(400);
    await f.customer.post('/shipments/quote', { ...booking(), service: 'SAME_DAY', delivery: { ...booking().delivery, lat: 55, lng: 1 } }).expect(400);
}
finally {
    f.db.close();
} });
