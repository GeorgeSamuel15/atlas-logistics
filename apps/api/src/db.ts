import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
export function openDb(file = process.env.DB_PATH || path.resolve('data/atlas.sqlite')) {
    if (file !== ':memory:')
        fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    migrate(db);
    return db;
}
export type DB = DatabaseSync;
export const all = <T>(db: DB, sql: string, ...args: SQLInputValue[]) => db.prepare(sql).all(...args) as unknown as T[];
export const one = <T>(db: DB, sql: string, ...args: SQLInputValue[]) => db.prepare(sql).get(...args) as unknown as T | undefined;
export function transaction<T>(db: DB, fn: () => T): T { db.exec('BEGIN IMMEDIATE'); try {
    const result = fn();
    db.exec('COMMIT');
    return result;
}
catch (e) {
    db.exec('ROLLBACK');
    throw e;
} }
function migrate(db: DB) {
    db.exec(`CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);`);
    if (one(db, 'SELECT version FROM migrations WHERE version=1'))
        return;
    transaction(db, () => db.exec(`
 CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,phone TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('ADMIN','DISPATCHER','WAREHOUSE','FINANCE','DRIVER','CUSTOMER')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),created_at TEXT NOT NULL);
 CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires_at TEXT NOT NULL);
 CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE rates(service TEXT PRIMARY KEY,base INTEGER NOT NULL,per_km INTEGER NOT NULL,per_kg INTEGER NOT NULL,multiplier REAL NOT NULL,sla_hours INTEGER NOT NULL);
 CREATE TABLE vehicles(id TEXT PRIMARY KEY,plate TEXT UNIQUE NOT NULL,model TEXT NOT NULL,capacity REAL NOT NULL CHECK(capacity>0),status TEXT NOT NULL CHECK(status IN('AVAILABLE','MAINTENANCE','INACTIVE')),odometer INTEGER NOT NULL DEFAULT 0,service_due TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE maintenance(id TEXT PRIMARY KEY,vehicle_id TEXT NOT NULL REFERENCES vehicles(id),description TEXT NOT NULL,cost INTEGER NOT NULL,odometer INTEGER NOT NULL,performed_at TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE hubs(id TEXT PRIMARY KEY,name TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,capacity INTEGER NOT NULL CHECK(capacity>0));
 CREATE TABLE shipments(id TEXT PRIMARY KEY,tracking TEXT UNIQUE NOT NULL,customer_id TEXT NOT NULL REFERENCES users(id),recipient_name TEXT NOT NULL,recipient_phone TEXT NOT NULL,pickup_address TEXT NOT NULL,pickup_city TEXT NOT NULL,pickup_lat REAL NOT NULL,pickup_lng REAL NOT NULL,delivery_address TEXT NOT NULL,delivery_city TEXT NOT NULL,delivery_lat REAL NOT NULL,delivery_lng REAL NOT NULL,weight REAL NOT NULL,length REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,declared_value INTEGER NOT NULL,service TEXT NOT NULL REFERENCES rates(service),status TEXT NOT NULL CHECK(status IN('BOOKED','ASSIGNED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED')),price INTEGER NOT NULL CHECK(price>=0),distance REAL NOT NULL,quote_json TEXT NOT NULL,notes TEXT NOT NULL,pickup_at TEXT NOT NULL,due_at TEXT NOT NULL,driver_id TEXT REFERENCES users(id),vehicle_id TEXT REFERENCES vehicles(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,proof_name TEXT,proof_note TEXT,delivered_at TEXT);
 CREATE TABLE events(id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL REFERENCES shipments(id),status TEXT NOT NULL,note TEXT NOT NULL,actor_id TEXT REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE TABLE locations(id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL REFERENCES shipments(id),driver_id TEXT NOT NULL REFERENCES users(id),lat REAL NOT NULL,lng REAL NOT NULL,accuracy REAL NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE invoices(id TEXT PRIMARY KEY,number TEXT UNIQUE NOT NULL,shipment_id TEXT UNIQUE NOT NULL REFERENCES shipments(id),customer_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>=0),status TEXT NOT NULL CHECK(status IN('OPEN','PAID','VOID')),created_at TEXT NOT NULL);
 CREATE TABLE payments(id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES invoices(id),amount INTEGER NOT NULL CHECK(amount>0),reference TEXT UNIQUE NOT NULL,method TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE TABLE routes(id TEXT PRIMARY KEY,name TEXT NOT NULL,driver_id TEXT NOT NULL REFERENCES users(id),vehicle_id TEXT NOT NULL REFERENCES vehicles(id),route_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('PLANNED','ACTIVE','COMPLETED')),created_at TEXT NOT NULL);
 CREATE TABLE stops(id TEXT PRIMARY KEY,route_id TEXT NOT NULL REFERENCES routes(id),shipment_id TEXT NOT NULL REFERENCES shipments(id),position INTEGER NOT NULL,UNIQUE(route_id,shipment_id),UNIQUE(route_id,position));
 CREATE TABLE custody(shipment_id TEXT PRIMARY KEY REFERENCES shipments(id),hub_id TEXT NOT NULL REFERENCES hubs(id),received_at TEXT NOT NULL);
 CREATE TABLE scans(id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL REFERENCES shipments(id),hub_id TEXT NOT NULL REFERENCES hubs(id),action TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE TABLE tickets(id TEXT PRIMARY KEY,subject TEXT NOT NULL,customer_id TEXT NOT NULL REFERENCES users(id),shipment_id TEXT REFERENCES shipments(id),priority TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE messages(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES tickets(id),actor_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,body TEXT NOT NULL,link TEXT NOT NULL,read_at TEXT,created_at TEXT NOT NULL);
 CREATE TABLE audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX shipment_customer ON shipments(customer_id,created_at);
 CREATE INDEX shipment_driver ON shipments(driver_id,status);
 CREATE INDEX shipment_status ON shipments(status,created_at);
 CREATE INDEX event_shipment ON events(shipment_id,created_at);
 CREATE INDEX notification_user ON notifications(user_id,created_at);
 CREATE INDEX location_shipment ON locations(shipment_id,created_at);
 CREATE INDEX payment_invoice ON payments(invoice_id);
 INSERT INTO settings VALUES('company','Atlas Logistics'),('currency','USD'),('supportEmail','support@example.com');
 INSERT INTO rates VALUES('STANDARD',800,45,80,1,72),('EXPRESS',1400,65,100,1.25,24),('SAME_DAY',2000,90,130,1.5,8);
 INSERT INTO migrations VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 `));
}
