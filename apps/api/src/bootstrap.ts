import { openDb, one } from './db.js';
import { hashPassword, id, now } from './core.js';
import { registerSchema } from '../../../packages/shared/src/index.js';
const db = openDb();
try {
    if (one(db, 'SELECT id FROM users LIMIT 1'))
        throw new Error('Bootstrap requires an empty database. Existing accounts are never overwritten.');
    const input = registerSchema.parse({ name: process.env.BOOTSTRAP_NAME || 'Administrator', email: process.env.BOOTSTRAP_EMAIL, password: process.env.BOOTSTRAP_PASSWORD, phone: process.env.BOOTSTRAP_PHONE || 'Not provided' });
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)').run(id(), input.name, input.email, hashPassword(input.password), input.phone, 'ADMIN', 1, now());
    console.log('Administrator created. No demo records were inserted.');
}
finally {
    db.close();
}
