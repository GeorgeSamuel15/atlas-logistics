import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import type { DB } from './db.js';
import { all, one } from './db.js';
import { auth, HttpError, check, now } from './core.js';
import { authRoutes } from './modules/auth.js';
import { shipmentRoutes } from './modules/shipments.js';
import { fleetRoutes, hubRoutes, routeRoutes } from './modules/operations.js';
import { financeRoutes } from './modules/finance.js';
import { supportRoutes } from './modules/support.js';
import { userRoutes, adminRoutes, dashboardRoutes, reportRoutes } from './modules/admin.js';
export function createApp(db: DB) {
    const app = express();
    const configuredOrigins = (process.env.APP_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173',
        'http://localhost:5174', 'http://127.0.0.1:5174',
        'http://localhost:4000', 'http://127.0.0.1:4000'];
    // Local development remains usable with an older shell setting. Production is explicit-only.
    const allowedOrigins = new Set(process.env.NODE_ENV === 'production'
        ? configuredOrigins : [...localOrigins, ...configuredOrigins]);
    app.disable('x-powered-by');
    app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null } } }));
    app.use(express.json({ limit: '128kb' }), cookieParser());
    app.use('/api', (req, _res, next) => { if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.get('origin');
        if (origin && !allowedOrigins.has(origin))
            return next(new HttpError(403, `Origin not allowed: ${origin}. Add this exact address to APP_ORIGINS and restart the API.`));
    } next(); });
    app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Atlas API' }));
    app.get('/api/track/:tracking', rateLimit({ windowMs: 60000, limit: 40 }), (req, res) => { const s = one<{
        id: string;
        tracking: string;
        status: string;
        service: string;
        due_at: string;
        created_at: string;
    }>(db, 'SELECT id,tracking,status,service,due_at,created_at FROM shipments WHERE tracking=?', String(req.params.tracking).toUpperCase()); check(s, 'Tracking number not found', 404); res.json({ tracking: s.tracking, status: s.status, service: s.service, dueAt: s.due_at, createdAt: s.created_at, events: all(db, 'SELECT status,created_at FROM events WHERE shipment_id=? ORDER BY created_at', s.id) }); });
    app.use('/api/auth', authRoutes(db));
    app.use('/api', auth(db));
    app.use('/api/shipments', shipmentRoutes(db));
    app.use('/api/fleet', fleetRoutes(db));
    app.use('/api/hubs', hubRoutes(db));
    app.use('/api/routes', routeRoutes(db));
    app.use('/api/invoices', financeRoutes(db));
    app.use('/api/tickets', supportRoutes(db));
    app.use('/api/users', userRoutes(db));
    app.use('/api/admin', adminRoutes(db));
    app.use('/api/dashboard', dashboardRoutes(db));
    app.use('/api/reports', reportRoutes(db));
    app.get('/api/notifications', (req, res) => res.json({ items: all(db, 'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', req.user.id), unread: one<{
            n: number;
        }>(db, 'SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL', req.user.id)!.n }));
    app.post('/api/notifications/read', (req, res) => { db.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').run(now(), req.user.id); res.json({ ok: true }); });
    app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { if (err instanceof ZodError)
        return res.status(400).json({ error: err.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ') }); if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message }); if (err instanceof Error && err.message.includes('UNIQUE constraint'))
        return res.status(409).json({ error: 'This record already exists' }); if (err instanceof Error && err.message.includes('FOREIGN KEY constraint'))
        return res.status(400).json({ error: 'A referenced record does not exist' }); if (err instanceof SyntaxError)
        return res.status(400).json({ error: 'Invalid JSON' }); console.error(err); return res.status(500).json({ error: 'Unexpected server error' }); });
    return app;
}
