import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './db.js';
import { createApp } from './app.js';
const db = openDb();
const app = createApp(db);
const web = path.resolve('../web/dist');
if (fs.existsSync(web)) {
    app.use(express.static(web));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(web, 'index.html')));
}
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Atlas API running on http://localhost:${port}`));
for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
