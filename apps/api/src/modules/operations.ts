import { Router } from 'express';
import { z } from 'zod';
import { type DB, one, all, transaction } from '../db.js';
import { id, now, check, permit, audit, activeStatuses, shipmentFor, event } from '../core.js';
import type { Vehicle, Shipment } from '../../../../packages/shared/src/index.js';
import { distanceKm } from './shipments.js';
export function fleetRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN', 'DISPATCHER'));
    r.get('/', (_req, res) => res.json(all(db, `SELECT v.*,COALESCE((SELECT SUM(weight) FROM shipments s WHERE s.vehicle_id=v.id AND s.status IN ${activeStatuses}),0) load FROM vehicles v ORDER BY plate`)));
    const schema = z.object({ plate: z.string().trim().min(2).max(25).transform(v => v.toUpperCase()), model: z.string().trim().min(2).max(80), capacity: z.number().positive().max(100000), status: z.enum(['AVAILABLE', 'MAINTENANCE', 'INACTIVE']), odometer: z.number().int().min(0), serviceDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
    r.post('/', (req, res) => { const v = schema.parse(req.body), key = id(); db.prepare('INSERT INTO vehicles VALUES(?,?,?,?,?,?,?,?)').run(key, v.plate, v.model, v.capacity, v.status, v.odometer, v.serviceDue, now()); audit(db, req.user.id, 'CREATE', 'vehicle', key); res.status(201).json({ id: key }); });
    r.patch('/:id', (req, res) => { const v = schema.parse(req.body), key = String(req.params.id); const old = one<Vehicle>(db, 'SELECT * FROM vehicles WHERE id=?', key); check(old, 'Vehicle not found', 404); const load = one<{
        n: number;
        weight: number;
    }>(db, `SELECT COUNT(*) n,COALESCE(SUM(weight),0) weight FROM shipments WHERE vehicle_id=? AND status IN ${activeStatuses}`, key)!; check(v.capacity >= load.weight, 'Capacity is below current assigned load'); check(!load.n || v.status === 'AVAILABLE', 'Vehicle has active shipments'); check(v.odometer >= old.odometer, 'Odometer cannot decrease'); db.prepare('UPDATE vehicles SET plate=?,model=?,capacity=?,status=?,odometer=?,service_due=? WHERE id=?').run(v.plate, v.model, v.capacity, v.status, v.odometer, v.serviceDue, key); audit(db, req.user.id, 'UPDATE', 'vehicle', key); res.json({ ok: true }); });
    r.get('/:id/maintenance', (req, res) => res.json(all(db, 'SELECT * FROM maintenance WHERE vehicle_id=? ORDER BY performed_at DESC', String(req.params.id))));
    r.post('/:id/maintenance', (req, res) => { const v = z.object({ description: z.string().trim().min(5).max(500), cost: z.number().int().min(0), odometer: z.number().int().min(0), performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body), key = String(req.params.id); const vehicle = one<Vehicle>(db, 'SELECT * FROM vehicles WHERE id=?', key); check(vehicle, 'Vehicle not found', 404); check(v.odometer >= vehicle.odometer, 'Odometer cannot decrease'); transaction(db, () => { db.prepare('INSERT INTO maintenance VALUES(?,?,?,?,?,?,?)').run(id(), key, v.description, v.cost, v.odometer, v.performedAt, now()); db.prepare('UPDATE vehicles SET odometer=? WHERE id=?').run(v.odometer, key); audit(db, req.user.id, 'MAINTENANCE', 'vehicle', key, v.description); }); res.status(201).json({ ok: true }); });
    return r;
}
export function hubRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN', 'DISPATCHER', 'WAREHOUSE'));
    r.get('/', (_req, res) => res.json(all(db, 'SELECT h.*,(SELECT COUNT(*) FROM custody c WHERE c.hub_id=h.id) occupancy FROM hubs h ORDER BY name')));
    r.post('/', permit('ADMIN', 'DISPATCHER'), (req, res) => { const v = z.object({ name: z.string().min(2).max(100), city: z.string().min(2).max(100), address: z.string().min(5).max(250), capacity: z.number().int().positive().max(100000) }).parse(req.body); const key = id(); db.prepare('INSERT INTO hubs VALUES(?,?,?,?,?)').run(key, v.name, v.city, v.address, v.capacity); audit(db, req.user.id, 'CREATE', 'hub', key); res.status(201).json({ id: key }); });
    r.get('/scans', (_req, res) => res.json(all(db, 'SELECT sc.*,s.tracking,h.name hub_name,u.name actor_name FROM scans sc JOIN shipments s ON s.id=sc.shipment_id JOIN hubs h ON h.id=sc.hub_id JOIN users u ON u.id=sc.actor_id ORDER BY sc.created_at DESC LIMIT 100')));
    r.post('/scans', (req, res) => { const v = z.object({ tracking: z.string(), hubId: z.string(), action: z.enum(['RECEIVE', 'DEPART']) }).parse(req.body); transaction(db, () => { const s = one<Shipment>(db, 'SELECT * FROM shipments WHERE tracking=?', v.tracking.trim().toUpperCase()); check(s, 'Tracking number not found', 404); check(['PICKED_UP', 'IN_TRANSIT'].includes(s.status), 'Warehouse scanning requires a picked-up or in-transit shipment'); const hub = one<{
        name: string;
        capacity: number;
    }>(db, 'SELECT * FROM hubs WHERE id=?', v.hubId); check(hub, 'Hub not found', 404); const custody = one<{
        hub_id: string;
    }>(db, 'SELECT * FROM custody WHERE shipment_id=?', s.id); if (v.action === 'RECEIVE') {
        check(!custody, 'Shipment is already held at a hub', 409);
        const n = one<{
            n: number;
        }>(db, 'SELECT COUNT(*) n FROM custody WHERE hub_id=?', v.hubId)!.n;
        check(n < hub.capacity, 'Hub is at capacity');
        db.prepare('INSERT INTO custody VALUES(?,?,?)').run(s.id, v.hubId, now());
    }
    else {
        check(custody?.hub_id === v.hubId, 'Shipment is not held at this hub', 409);
        db.prepare('DELETE FROM custody WHERE shipment_id=?').run(s.id);
    } db.prepare('INSERT INTO scans VALUES(?,?,?,?,?,?)').run(id(), s.id, v.hubId, v.action, req.user.id, now()); event(db, s, s.status, `${v.action === 'RECEIVE' ? 'Received at' : 'Departed from'} ${hub.name}`, req.user.id); audit(db, req.user.id, 'SCAN', 'shipment', s.id, v.action); }); res.status(201).json({ ok: true }); });
    return r;
}
export function routeRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN', 'DISPATCHER', 'DRIVER'));
    r.get('/', (req, res) => res.json(all(db, `SELECT r.*,u.name driver_name,v.plate,(SELECT COUNT(*) FROM stops st WHERE st.route_id=r.id) stop_count FROM routes r JOIN users u ON u.id=r.driver_id JOIN vehicles v ON v.id=r.vehicle_id ${req.user.role === 'DRIVER' ? 'WHERE r.driver_id=?' : ''} ORDER BY route_date DESC`, ...(req.user.role === 'DRIVER' ? [req.user.id] : []))));
    r.get('/:id', (req, res) => { const route = one<{
        id: string;
        driver_id: string;
    }>(db, 'SELECT * FROM routes WHERE id=?', String(req.params.id)); check(route, 'Route not found', 404); check(req.user.role !== 'DRIVER' || route.driver_id === req.user.id, 'Route not found', 404); res.json({ route, stops: all(db, 'SELECT s.*,st.position FROM stops st JOIN shipments s ON s.id=st.shipment_id WHERE st.route_id=? ORDER BY st.position', route.id) }); });
    r.post('/', permit('ADMIN', 'DISPATCHER'), (req, res) => { const v = z.object({ name: z.string().trim().min(2).max(100), driverId: z.string(), vehicleId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shipmentIds: z.array(z.string()).min(1).max(60), optimize: z.boolean().default(false) }).parse(req.body); check(new Set(v.shipmentIds).size === v.shipmentIds.length, 'Duplicate shipment'); const key = id(); transaction(db, () => { check(one(db, "SELECT id FROM users WHERE id=? AND active=1 AND role='DRIVER'", v.driverId), 'Active driver required'); check(one(db, "SELECT id FROM vehicles WHERE id=? AND status='AVAILABLE'", v.vehicleId), 'Available vehicle required'); check(!one(db, "SELECT id FROM routes WHERE route_date=? AND status!='COMPLETED' AND (driver_id=? OR vehicle_id=?)", v.date, v.driverId, v.vehicleId), 'Driver or vehicle already has an open route on this date'); let shipments = v.shipmentIds.map(sid => { const s = shipmentFor(db, req.user, sid); check(s.driver_id === v.driverId && s.vehicle_id === v.vehicleId, 'All shipments must be assigned to the selected driver and vehicle'); check(['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status), 'Route contains an ineligible shipment'); check(!one(db, "SELECT st.id FROM stops st JOIN routes r ON r.id=st.route_id WHERE st.shipment_id=? AND r.status!='COMPLETED'", sid), 'Shipment is already on an open route'); return s; }); if (v.optimize) {
        const ordered: Shipment[] = [];
        let lat = shipments[0].pickup_lat, lng = shipments[0].pickup_lng;
        while (shipments.length) {
            shipments.sort((a, b) => distanceKm(lat, lng, a.delivery_lat, a.delivery_lng) - distanceKm(lat, lng, b.delivery_lat, b.delivery_lng));
            const next = shipments.shift()!;
            ordered.push(next);
            lat = next.delivery_lat;
            lng = next.delivery_lng;
        }
        shipments = ordered;
    } db.prepare('INSERT INTO routes VALUES(?,?,?,?,?,?,?)').run(key, v.name, v.driverId, v.vehicleId, v.date, 'PLANNED', now()); shipments.forEach((s, index) => db.prepare('INSERT INTO stops VALUES(?,?,?,?)').run(id(), key, s.id, index + 1)); audit(db, req.user.id, 'CREATE', 'route', key); }); res.status(201).json({ id: key }); });
    r.post('/:id/status', (req, res) => { const v = z.object({ status: z.enum(['ACTIVE', 'COMPLETED']) }).parse(req.body), key = String(req.params.id); transaction(db, () => { const route = one<{
        driver_id: string;
        status: string;
    }>(db, 'SELECT * FROM routes WHERE id=?', key); check(route, 'Route not found', 404); check(req.user.role !== 'DRIVER' || route.driver_id === req.user.id, 'Route not found', 404); check((route.status === 'PLANNED' && v.status === 'ACTIVE') || (route.status === 'ACTIVE' && v.status === 'COMPLETED'), 'Invalid route transition'); if (v.status === 'COMPLETED')
        check(!one(db, "SELECT st.id FROM stops st JOIN shipments s ON s.id=st.shipment_id WHERE st.route_id=? AND s.status NOT IN('DELIVERED','RETURNED','CANCELLED')", key), 'Finish all route shipments first'); db.prepare('UPDATE routes SET status=? WHERE id=?').run(v.status, key); audit(db, req.user.id, 'STATUS', 'route', key, v.status); }); res.json({ ok: true }); });
    return r;
}
