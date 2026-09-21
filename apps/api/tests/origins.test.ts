import { test } from 'node:test';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';

test('development sign-in accepts port 5174 despite stale settings; production stays explicit', async () => {
    const previousOrigins = process.env.APP_ORIGINS;
    const previousMode = process.env.NODE_ENV;
    const db = openDb(':memory:');
    const credentials = { email: 'admin@atlas.demo', password: 'AtlasDemo!2026' };
    try {
        seed(db);
        process.env.NODE_ENV = 'development';
        process.env.APP_ORIGINS = 'http://localhost:5173, https://atlas.example ';
        const dev = createApp(db);
        for (const origin of ['http://127.0.0.1:5174', 'http://localhost:5174', 'http://localhost:5173', 'https://atlas.example']) {
            await request(dev).post('/api/auth/login').set('Origin', origin).send(credentials).expect(200);
        }
        for (const origin of ['https://attacker.example', 'http://127.0.0.1.attacker.example:5174', 'http://127.0.0.1:5175']) {
            await request(dev).post('/api/auth/login').set('Origin', origin).send(credentials).expect(403);
        }
        process.env.NODE_ENV = 'production';
        const prod = createApp(db);
        await request(prod).post('/api/auth/login').set('Origin', 'http://127.0.0.1:5174').send(credentials).expect(403);
        await request(prod).post('/api/auth/login').set('Origin', 'https://atlas.example').send(credentials).expect(200);
    } finally {
        db.close();
        if (previousOrigins === undefined) delete process.env.APP_ORIGINS; else process.env.APP_ORIGINS = previousOrigins;
        if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    }
});
