import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { type DB, openDb, one } from './db.js';
import { id, now, hashPassword } from './core.js';
import { createShipment } from './modules/shipments.js';
import type { User, Booking } from '../../../packages/shared/src/index.js';
export function seed(db: DB) {
    if (one(db, 'SELECT id FROM users LIMIT 1'))
        return false;
    const password = hashPassword('AtlasDemo!2026');
    const users = [['admin', 'Alex Morgan', 'ADMIN'], ['dispatch', 'Jordan Lee', 'DISPATCHER'], ['warehouse', 'Casey Brooks', 'WAREHOUSE'], ['finance', 'Taylor Reed', 'FINANCE'], ['driver', 'Sam Rivera', 'DRIVER'], ['customer', 'Morgan Studio', 'CUSTOMER'], ['driver2', 'Jamie Chen', 'DRIVER'], ['customer2', 'Northstar Supplies', 'CUSTOMER']] as const;
    for (const [key, name, role] of users)
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)').run(key, name, `${key}@atlas.demo`, password, '+44 7700 900123', role, 1, now());
    for (const v of [['van1', 'ATL-204', 'Ford Transit', 1400, 'AVAILABLE', 24500, '2026-12-01'], ['van2', 'ATL-318', 'Mercedes Sprinter', 2000, 'AVAILABLE', 18200, '2026-11-15'], ['bike1', 'ATL-052', 'Urban Cargo Bike', 80, 'AVAILABLE', 3400, '2026-10-20'], ['van3', 'ATL-411', 'Renault Master', 1600, 'MAINTENANCE', 65000, '2026-09-20']] as const)
        db.prepare('INSERT INTO vehicles VALUES(?,?,?,?,?,?,?,?)').run(...v, now());
    db.prepare('INSERT INTO maintenance VALUES(?,?,?,?,?,?,?)').run(id(), 'van3', 'Brake inspection and replacement', 32500, 65000, '2026-09-15', now());
    for (const h of [['hub1', 'London Central', 'London', '28 Commercial Road, London', 400], ['hub2', 'Birmingham Gateway', 'Birmingham', '80 Station Road, Birmingham', 600], ['hub3', 'Manchester North', 'Manchester', '12 Logistics Way, Manchester', 500]] as const)
        db.prepare('INSERT INTO hubs VALUES(?,?,?,?,?)').run(...h);
    const states = ['BOOKED', 'BOOKED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED', 'DELIVERED'] as const;
    const destinations = [['Camden', 51.539, -.143], ['Greenwich', 51.482, -.007], ['Shoreditch', 51.526, -.078], ['Richmond', 51.461, -.303], ['Birmingham', 52.486, -1.89], ['Manchester', 53.481, -2.243]] as const;
    for (let i = 0; i < 30; i++) {
        const dest = destinations[i % destinations.length];
        const service = i % 3 === 0 ? 'EXPRESS' : i % 3 === 1 ? 'STANDARD' : 'SAME_DAY';
        const target = service === 'SAME_DAY' ? destinations[i % 4] : dest;
        const b: Booking = { pickup: { address: '24 Studio Lane, London', city: 'London', lat: 51.5074, lng: -.1278 }, delivery: { address: `${10 + i} Market Street, ${target[0]}`, city: target[0], lat: target[1], lng: target[2] }, recipientName: ['Avery Collins', 'Riley Harper', 'Cameron Ellis', 'Quinn Parker'][i % 4], recipientPhone: '+44 7700 900456', weight: 2 + i % 8, length: 30, width: 20, height: 15, declaredValue: 15000, service, pickupAt: new Date(Date.now() + 3600000).toISOString(), notes: ['Fragile packaging. Handle with care.', 'Call recipient on arrival.', 'Leave with reception if available.'][i % 3], customerId: i % 3 === 0 ? 'customer2' : 'customer' };
        const actor = one<User>(db, 'SELECT * FROM users WHERE id=?', b.customerId!)!;
        const s = createShipment(db, b, actor);
        const state = states[i % states.length];
        const created = new Date(Date.now() - (i % 12) * 86400000 - 4 * 3600000).toISOString();
        const pickup = new Date(new Date(created).getTime() + 3600000).toISOString();
        const due = new Date(new Date(pickup).getTime() + (service === 'STANDARD' ? 72 : service === 'EXPRESS' ? 24 : 8) * 3600000).toISOString();
        const terminal = ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(state);
        const driver = i % 2 ? 'driver' : 'driver2', vehicle = i % 2 ? 'van1' : 'van2';
        const delivered = state === 'DELIVERED' ? new Date(new Date(pickup).getTime() + 3 * 3600000).toISOString() : null;
        db.prepare('UPDATE shipments SET status=?,created_at=?,updated_at=?,pickup_at=?,due_at=?,driver_id=?,vehicle_id=?,proof_name=?,proof_note=?,delivered_at=? WHERE id=?').run(state, created, delivered || now(), pickup, due, state === 'BOOKED' || state === 'CANCELLED' ? null : driver, state === 'BOOKED' || state === 'CANCELLED' ? null : vehicle, state === 'DELIVERED' ? b.recipientName : null, state === 'DELIVERED' ? 'Received at reception' : null, delivered, s.id);
        db.prepare('UPDATE events SET created_at=? WHERE shipment_id=?').run(created, s.id);
        if (state !== 'BOOKED')
            db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(id(), s.id, state, terminal ? 'Synthetic demo history' : 'Demo shipment in progress', 'dispatch', delivered || now());
        db.prepare('UPDATE invoices SET created_at=? WHERE shipment_id=?').run(created, s.id);
        if (state === 'CANCELLED')
            db.prepare("UPDATE invoices SET status='VOID' WHERE shipment_id=?").run(s.id);
        if (state === 'DELIVERED' && i % 2 === 0) {
            const inv = one<{
                id: string;
            }>(db, 'SELECT id FROM invoices WHERE shipment_id=?', s.id)!;
            db.prepare('INSERT INTO payments VALUES(?,?,?,?,?,?,?)').run(id(), inv.id, s.price, `DEMO-${i}`, 'BANK_TRANSFER', 'finance', now());
            db.prepare("UPDATE invoices SET status='PAID' WHERE id=?").run(inv.id);
        }
        if (state === 'IN_TRANSIT') {
            db.prepare('INSERT INTO custody VALUES(?,?,?)').run(s.id, 'hub1', now());
            db.prepare('INSERT INTO scans VALUES(?,?,?,?,?,?)').run(id(), s.id, 'hub1', 'RECEIVE', 'warehouse', now());
        }
    }
    const ticket = id();
    db.prepare('INSERT INTO tickets VALUES(?,?,?,?,?,?,?,?)').run(ticket, 'Can I update my delivery instructions?', 'customer', null, 'NORMAL', 'OPEN', now(), now());
    db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(id(), ticket, 'customer', 'Please ask the driver to use the side entrance and call reception.', now());
    return true;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    if (process.env.NODE_ENV === 'production')
        throw Error('Demo seeding is disabled in production');
    const db = openDb();
    console.log(seed(db) ? 'Demo dataset created. Sign in: admin@atlas.demo / AtlasDemo!2026' : 'Database already contains users; no records changed.');
    db.close();
}
