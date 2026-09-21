import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { type DB, one, all } from './db.js';
import type { Role, User, Shipment } from '../../../packages/shared/src/index.js';
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function check(value: unknown, message: string, status = 400): asserts value { if (!value)
    throw new HttpError(status, message); }
export const hashToken = (v: string) => createHash('sha256').update(v).digest('hex');
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }
export function verifyPassword(password: string, hash: string) { const [salt, key] = hash.split(':'); const actual = scryptSync(password, salt, 64); const expected = Buffer.from(key, 'hex'); return expected.length === actual.length && timingSafeEqual(expected, actual); }
declare global {
    namespace Express {
        interface Request {
            user: User;
            session: {
                csrf: string;
                token_hash: string;
            };
        }
    }
}
export function auth(db: DB) { return (req: Request, _res: Response, next: NextFunction) => { try {
    const token = req.cookies.atlas_session;
    check(typeof token === 'string', 'Please sign in', 401);
    const s = one<{
        csrf: string;
        token_hash: string;
        user_id: string;
    }>(db, 'SELECT * FROM sessions WHERE token_hash=? AND expires_at>?', hashToken(token), now());
    check(s, 'Session expired', 401);
    const u = one<User>(db, 'SELECT id,name,email,role,phone,active,created_at FROM users WHERE id=? AND active=1', s.user_id);
    check(u, 'Account unavailable', 401);
    req.user = u;
    req.session = s;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
        check(req.get('x-csrf-token') === s.csrf, 'Invalid request token', 403);
    next();
}
catch (e) {
    next(e);
} }; }
export function permit(...roles: Role[]) { return (req: Request, _res: Response, next: NextFunction) => { if (!roles.includes(req.user.role))
    return next(new HttpError(403, 'This role cannot perform that action')); next(); }; }
export const staffRoles: Role[] = ['ADMIN', 'DISPATCHER', 'WAREHOUSE', 'FINANCE'];
export function audit(db: DB, actor: string | null, action: string, entity: string, entityId: string, detail = '') { db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?)').run(id(), actor, action, entity, entityId, detail, now()); }
export function notify(db: DB, userId: string, title: string, body: string, link: string) { db.prepare('INSERT INTO notifications VALUES(?,?,?,?,?,?,?)').run(id(), userId, title, body, link, null, now()); }
export function event(db: DB, shipment: Shipment, status: string, note: string, actor: string) { db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(id(), shipment.id, status, note, actor, now()); notify(db, shipment.customer_id, 'Shipment update', `${shipment.tracking}: ${status.replaceAll('_', ' ')}`, `/shipments/${shipment.id}`); }
export function shipmentFor(db: DB, user: User, shipmentId: string) { const s = one<Shipment>(db, `SELECT s.*,u.name customer_name,d.name driver_name,v.plate FROM shipments s JOIN users u ON u.id=s.customer_id LEFT JOIN users d ON d.id=s.driver_id LEFT JOIN vehicles v ON v.id=s.vehicle_id WHERE s.id=?`, shipmentId); check(s, 'Shipment not found', 404); check(user.role !== 'CUSTOMER' || s.customer_id === user.id, 'Shipment not found', 404); check(user.role !== 'DRIVER' || s.driver_id === user.id, 'Shipment not found', 404); return s; }
export function scope(user: User, alias = 's') { return user.role === 'CUSTOMER' ? { sql: `${alias}.customer_id=?`, args: [user.id] } : user.role === 'DRIVER' ? { sql: `${alias}.driver_id=?`, args: [user.id] } : { sql: '1=1', args: [] }; }
export function setting(db: DB, key: string) { return one<{
    value: string;
}>(db, 'SELECT value FROM settings WHERE key=?', key)!.value; }
export const activeStatuses = "('ASSIGNED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','FAILED')";
export function pageParams(req: Request) { const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1)); const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25)); return { page: Math.floor(page), limit: Math.floor(limit) }; }
export function safeCsv(rows: Record<string, unknown>[]) { if (!rows.length)
    return ''; const keys = Object.keys(rows[0]); const cell = (value: unknown) => { let s = String(value ?? ''); if (/^[\s]*[=+@\-]/.test(s))
    s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }; return [keys.map(cell).join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n'); }
