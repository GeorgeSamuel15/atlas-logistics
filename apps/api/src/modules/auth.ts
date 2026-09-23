import { Router, type CookieOptions } from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import { type DB, one, transaction } from '../db.js';
import {
    id,
    now,
    check,
    hashPassword,
    verifyPassword,
    hashToken,
    auth,
    audit
} from '../core.js';

import {
    loginSchema,
    registerSchema,
    type User
} from '../../../../packages/shared/src/index.js';

export function authRoutes(db: DB) {
    const r = Router();

    const limit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        standardHeaders: 'draft-8',
        legacyHeaders: false
    });

    const cookie: CookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/api',
        maxAge: 8 * 3600000
    };

    function session(
        user: User,
        res: import('express').Response
    ) {
        const token = randomBytes(32).toString('hex');
        const csrf = randomBytes(24).toString('hex');

        db.prepare(
            'DELETE FROM sessions WHERE expires_at<?'
        ).run(now());

        db.prepare(
            'INSERT INTO sessions VALUES(?,?,?,?)'
        ).run(
            hashToken(token),
            user.id,
            csrf,
            new Date(Date.now() + 8 * 3600000).toISOString()
        );

        res.cookie('atlas_session', token, cookie);

        res.json({
            user,
            csrf
        });
    }

    r.post('/login', limit, (req, res) => {
        const input = loginSchema.parse(req.body);

        const u = one<User & {
            password_hash: string;
        }>(
            db,
            'SELECT * FROM users WHERE email=?',
            input.email
        );

        check(
            u && u.active && verifyPassword(input.password, u.password_hash),
            'Invalid email or password',
            401
        );

        const { password_hash: _, ...user } = u;

        session(user, res);

        audit(
            db,
            u.id,
            'LOGIN',
            'user',
            u.id
        );
    });

    r.post('/register', limit, (req, res) => {
        const v = registerSchema.parse(req.body);

        check(
            !one(db, 'SELECT id FROM users WHERE email=?', v.email),
            'Email already registered',
            409
        );

        const user: User = {
            id: id(),
            name: v.name,
            email: v.email,
            role: 'CUSTOMER',
            phone: v.phone,
            active: 1,
            created_at: now()
        };

        transaction(db, () => {
            db.prepare(
                'INSERT INTO users VALUES(?,?,?,?,?,?,?,?)'
            ).run(
                user.id,
                user.name,
                user.email,
                hashPassword(v.password),
                user.phone,
                user.role,
                1,
                user.created_at
            );

            audit(
                db,
                user.id,
                'REGISTER',
                'user',
                user.id
            );
        });

        session(user, res);
    });

    r.use(auth(db));

    r.get('/me', (req, res) => {
        res.json({
            user: req.user,
            csrf: req.session.csrf
        });
    });

    r.post('/logout', (req, res) => {
        db.prepare(
            'DELETE FROM sessions WHERE token_hash=?'
        ).run(req.session.token_hash);

        res.clearCookie('atlas_session', cookie);

        res.json({
            ok: true
        });
    });

    r.post('/password', (req, res) => {
        const v = z.object({
            current: z.string().max(128),
            password: z.string().min(12).max(128)
        }).parse(req.body);

        const u = one<{
            password_hash: string;
        }>(
            db,
            'SELECT password_hash FROM users WHERE id=?',
            req.user.id
        )!;

        check(
            verifyPassword(v.current, u.password_hash),
            'Current password is incorrect'
        );

        transaction(db, () => {
            db.prepare(
                'UPDATE users SET password_hash=? WHERE id=?'
            ).run(
                hashPassword(v.password),
                req.user.id
            );

            db.prepare(
                'DELETE FROM sessions WHERE user_id=?'
            ).run(req.user.id);

            audit(
                db,
                req.user.id,
                'PASSWORD_CHANGE',
                'user',
                req.user.id
            );
        });

        res.clearCookie('atlas_session', cookie);

        res.json({
            ok: true
        });
    });

    return r;
}