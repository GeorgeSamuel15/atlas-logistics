import { Router } from 'express';
import { z } from 'zod';
import { type DB, all, one, transaction } from '../db.js';
import { check, permit, id, now, audit, notify, shipmentFor } from '../core.js';
import type { Ticket, User } from '../../../../packages/shared/src/index.js';
export function supportRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN', 'DISPATCHER', 'CUSTOMER'));
    function ticketFor(user: User, key: string) { const t = one<Ticket>(db, 'SELECT * FROM tickets WHERE id=?', key); check(t, 'Ticket not found', 404); check(user.role !== 'CUSTOMER' || t.customer_id === user.id, 'Ticket not found', 404); return t; }
    r.get('/', (req, res) => res.json(all(db, `SELECT t.*,u.name customer_name FROM tickets t JOIN users u ON u.id=t.customer_id ${req.user.role === 'CUSTOMER' ? 'WHERE customer_id=?' : ''} ORDER BY t.updated_at DESC`, ...(req.user.role === 'CUSTOMER' ? [req.user.id] : []))));
    r.post('/', (req, res) => { const v = z.object({ subject: z.string().trim().min(5).max(160), body: z.string().trim().min(5).max(3000), priority: z.enum(['LOW', 'NORMAL', 'HIGH']), shipmentId: z.string().optional(), customerId: z.string().optional() }).parse(req.body); const customer = req.user.role === 'CUSTOMER' ? req.user.id : v.customerId; check(customer && one(db, "SELECT id FROM users WHERE id=? AND role='CUSTOMER'", customer), 'Customer required'); if (v.shipmentId) {
        const s = shipmentFor(db, req.user, v.shipmentId);
        check(s.customer_id === customer, 'Shipment belongs to another customer');
    } const key = id(); transaction(db, () => { db.prepare('INSERT INTO tickets VALUES(?,?,?,?,?,?,?,?)').run(key, v.subject, customer, v.shipmentId || null, v.priority, 'OPEN', now(), now()); db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(id(), key, req.user.id, v.body, now()); audit(db, req.user.id, 'CREATE', 'ticket', key); }); res.status(201).json({ id: key }); });
    r.get('/:id', (req, res) => { const ticket = ticketFor(req.user, String(req.params.id)); res.json({ ticket, messages: all(db, 'SELECT m.*,u.name actor_name,u.role FROM messages m JOIN users u ON u.id=m.actor_id WHERE ticket_id=? ORDER BY m.created_at', ticket.id) }); });
    r.post('/:id/messages', (req, res) => { const t = ticketFor(req.user, String(req.params.id)); const v = z.object({ body: z.string().trim().min(1).max(3000) }).parse(req.body); check(t.status !== 'CLOSED', 'Reopen the ticket before replying'); transaction(db, () => { db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(id(), t.id, req.user.id, v.body, now()); db.prepare('UPDATE tickets SET updated_at=? WHERE id=?').run(now(), t.id); if (req.user.id !== t.customer_id)
        notify(db, t.customer_id, 'Support reply', t.subject, '/support'); audit(db, req.user.id, 'REPLY', 'ticket', t.id); }); res.status(201).json({ ok: true }); });
    r.patch('/:id', permit('ADMIN', 'DISPATCHER'), (req, res) => { const t = ticketFor(req.user, String(req.params.id)), v = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']), priority: z.enum(['LOW', 'NORMAL', 'HIGH']) }).parse(req.body); db.prepare('UPDATE tickets SET status=?,priority=?,updated_at=? WHERE id=?').run(v.status, v.priority, now(), t.id); audit(db, req.user.id, 'UPDATE', 'ticket', t.id); res.json({ ok: true }); });
    return r;
}
