import { Router } from 'express';
import { z } from 'zod';
import { type DB, all, one, transaction } from '../db.js';
import { check, permit, id, now, audit, hashPassword, activeStatuses, scope, safeCsv } from '../core.js';
import { registerSchema, roles, type User } from '../../../../packages/shared/src/index.js';
export function userRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN', 'DISPATCHER', 'FINANCE'));
    r.get('/', (req, res) => { const role = req.query.role ? z.enum(roles).parse(req.query.role) : null; check(req.user.role === 'ADMIN' || role === 'CUSTOMER' || (req.user.role === 'DISPATCHER' && role === 'DRIVER'), 'Choose an allowed directory', 403); res.json(all(db, `SELECT id,name,email,phone,role,active,created_at FROM users ${role ? 'WHERE role=?' : ''} ORDER BY name`, ...(role ? [role] : []))); });
    r.post('/', permit('ADMIN'), (req, res) => { const v = registerSchema.extend({ role: z.enum(roles) }).parse(req.body); check(!one(db, 'SELECT id FROM users WHERE email=?', v.email), 'Email already exists', 409); const key = id(); db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)').run(key, v.name, v.email, hashPassword(v.password), v.phone, v.role, 1, now()); audit(db, req.user.id, 'CREATE', 'user', key); res.status(201).json({ id: key }); });
    r.patch('/:id', permit('ADMIN'), (req, res) => { const v = z.object({ active: z.boolean() }).parse(req.body), key = String(req.params.id); const u = one<User>(db, 'SELECT * FROM users WHERE id=?', key); check(u, 'User not found', 404); check(key !== req.user.id, 'You cannot deactivate your own account'); if (!v.active && u.role === 'ADMIN')
        check(one<{
            n: number;
        }>(db, "SELECT COUNT(*) n FROM users WHERE role='ADMIN' AND active=1")!.n > 1, 'Cannot deactivate the last administrator'); if (!v.active && u.role === 'DRIVER')
        check(!one(db, `SELECT id FROM shipments WHERE driver_id=? AND status IN ${activeStatuses}`, key), 'Reassign active deliveries before deactivating this driver'); transaction(db, () => { db.prepare('UPDATE users SET active=? WHERE id=?').run(v.active ? 1 : 0, key); if (!v.active)
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(key); audit(db, req.user.id, v.active ? 'ACTIVATE' : 'DEACTIVATE', 'user', key); }); res.json({ ok: true }); });
    return r;
}
export function adminRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN'));
    r.get('/settings', (_req, res) => res.json(Object.fromEntries(all<{
        key: string;
        value: string;
    }>(db, 'SELECT * FROM settings').map(x => [x.key, x.value]))));
    r.patch('/settings', (req, res) => { const v = z.object({ company: z.string().trim().min(2).max(100), supportEmail: z.string().email().max(160) }).parse(req.body); transaction(db, () => { for (const [key, value] of Object.entries(v))
        db.prepare('UPDATE settings SET value=? WHERE key=?').run(value, key); audit(db, req.user.id, 'UPDATE', 'settings', 'company'); }); res.json({ ok: true }); });
    r.get('/rates', (_req, res) => res.json(all(db, 'SELECT * FROM rates')));
    r.patch('/rates/:service', (req, res) => { const v = z.object({ base: z.number().int().min(0).max(100000), per_km: z.number().int().min(0).max(10000), per_kg: z.number().int().min(0).max(10000), multiplier: z.number().min(.1).max(10), sla_hours: z.number().int().min(1).max(720) }).parse(req.body); check(one(db, 'SELECT service FROM rates WHERE service=?', String(req.params.service)), 'Rate not found', 404); db.prepare('UPDATE rates SET base=?,per_km=?,per_kg=?,multiplier=?,sla_hours=? WHERE service=?').run(v.base, v.per_km, v.per_kg, v.multiplier, v.sla_hours, String(req.params.service)); audit(db, req.user.id, 'UPDATE', 'rate', String(req.params.service)); res.json({ ok: true }); });
    r.get('/audit', (req, res) => { const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100)); res.json(all(db, 'SELECT a.*,u.name actor_name FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT ?', limit)); });
    return r;
}
export function dashboardRoutes(db: DB) {
    const r = Router();
    r.get('/', (req, res) => { const sc = scope(req.user), rows = all<{
        status: string;
        count: number;
    }>(db, `SELECT status,COUNT(*) count FROM shipments s WHERE ${sc.sql} GROUP BY status`, ...sc.args); const total = rows.reduce((a, b) => a + b.count, 0), delivered = rows.find(x => x.status === 'DELIVERED')?.count ?? 0; res.json({ total, delivered, active: rows.filter(x => !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(x.status)).reduce((a, b) => a + b.count, 0), overdue: one<{
            n: number;
        }>(db, `SELECT COUNT(*) n FROM shipments s WHERE ${sc.sql} AND due_at<? AND status NOT IN('DELIVERED','RETURNED','CANCELLED')`, ...sc.args, now())!.n, statuses: rows, services: all(db, `SELECT service,COUNT(*) count FROM shipments s WHERE ${sc.sql} GROUP BY service`, ...sc.args), daily: all(db, `SELECT substr(created_at,1,10) day,COUNT(*) count FROM shipments s WHERE ${sc.sql} AND created_at>=? GROUP BY day ORDER BY day`, ...sc.args, new Date(Date.now() - 14 * 86400000).toISOString()), recent: all(db, `SELECT s.*,u.name customer_name FROM shipments s JOIN users u ON u.id=s.customer_id WHERE ${sc.sql} ORDER BY s.created_at DESC LIMIT 6`, ...sc.args), outstanding: ['ADMIN', 'FINANCE', 'CUSTOMER'].includes(req.user.role) ? one<{
            total: number;
        }>(db, `SELECT COALESCE(SUM(i.amount-COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id=i.id),0)),0) total FROM invoices i WHERE i.status='OPEN' ${req.user.role === 'CUSTOMER' ? 'AND customer_id=?' : ''}`, ...(req.user.role === 'CUSTOMER' ? [req.user.id] : []))!.total : null }); });
    return r;
}
export function reportRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN', 'DISPATCHER', 'FINANCE'));
    r.get('/', (req, res) => { const v = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query); check(v.from <= v.to, 'Start date must be before end date'); const end = v.to + 'T23:59:59.999Z'; const shipments = all<Record<string, unknown>>(db, 'SELECT tracking,service,status,pickup_city,delivery_city,weight,price,created_at,delivered_at,due_at FROM shipments WHERE created_at>=? AND created_at<=? ORDER BY created_at DESC', v.from, end); const payments = one<{
        amount: number;
        count: number;
    }>(db, 'SELECT COALESCE(SUM(amount),0) amount,COUNT(*) count FROM payments WHERE created_at>=? AND created_at<=?', v.from, end)!; res.json({ shipments, total: shipments.length, delivered: shipments.filter(s => s.status === 'DELIVERED').length, onTime: shipments.filter(s => s.delivered_at && String(s.delivered_at) <= String(s.due_at)).length, payments, byService: all(db, 'SELECT service,COUNT(*) count,SUM(price) quoted FROM shipments WHERE created_at>=? AND created_at<=? GROUP BY service', v.from, end) }); });
    r.get('/export', (req, res) => { const from = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.from), to = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.to); check(from <= to, 'Invalid date range'); const rows = all<Record<string, unknown>>(db, 'SELECT tracking,service,status,pickup_city,delivery_city,weight,price,created_at FROM shipments WHERE created_at>=? AND created_at<=? ORDER BY created_at', from, to + 'T23:59:59.999Z'); res.type('text/csv').attachment('atlas-shipments.csv').send(safeCsv(rows)); });
    return r;
}
