import { Router } from 'express';
import { z } from 'zod';
import { type DB, all, one, transaction } from '../db.js';
import { check, permit, id, now, audit, notify } from '../core.js';
import type { Invoice } from '../../../../packages/shared/src/index.js';
export function financeRoutes(db: DB) {
    const r = Router();
    r.use(permit('ADMIN', 'FINANCE', 'CUSTOMER'));
    const select = `SELECT i.*,u.name customer_name,s.tracking,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) paid FROM invoices i JOIN users u ON u.id=i.customer_id JOIN shipments s ON s.id=i.shipment_id`;
    r.get('/', (req, res) => res.json(all(db, select + (req.user.role === 'CUSTOMER' ? ' WHERE i.customer_id=?' : '') + ' ORDER BY i.created_at DESC', ...(req.user.role === 'CUSTOMER' ? [req.user.id] : []))));
    r.get('/:id', (req, res) => { const invoice = one<Invoice>(db, select + ' WHERE i.id=?', String(req.params.id)); check(invoice, 'Invoice not found', 404); check(req.user.role !== 'CUSTOMER' || invoice.customer_id === req.user.id, 'Invoice not found', 404); res.json({ invoice, payments: all(db, 'SELECT id,amount,reference,method,created_at FROM payments WHERE invoice_id=? ORDER BY created_at', invoice.id) }); });
    r.post('/:id/payments', permit('ADMIN', 'FINANCE'), (req, res) => { const v = z.object({ amount: z.number().int().positive().max(100000000), reference: z.string().trim().min(3).max(100), method: z.enum(['BANK_TRANSFER', 'CASH', 'EXTERNAL_CARD']) }).parse(req.body); transaction(db, () => { const invoice = one<Invoice>(db, select + ' WHERE i.id=?', String(req.params.id)); check(invoice, 'Invoice not found', 404); check(invoice.status === 'OPEN', 'Invoice is not open'); check(v.amount <= invoice.amount - invoice.paid, 'Payment exceeds outstanding balance'); check(!one(db, 'SELECT id FROM payments WHERE reference=?', v.reference), 'Payment reference already recorded', 409); db.prepare('INSERT INTO payments VALUES(?,?,?,?,?,?,?)').run(id(), invoice.id, v.amount, v.reference, v.method, req.user.id, now()); if (invoice.paid + v.amount === invoice.amount)
        db.prepare("UPDATE invoices SET status='PAID' WHERE id=?").run(invoice.id); audit(db, req.user.id, 'RECORD_PAYMENT', 'invoice', invoice.id, JSON.stringify(v)); notify(db, invoice.customer_id, 'Payment recorded', invoice.number, '/billing'); }); res.status(201).json({ ok: true }); });
    return r;
}
