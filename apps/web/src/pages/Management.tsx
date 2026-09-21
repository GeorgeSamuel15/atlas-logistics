import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Printer, Download, CheckCheck } from 'lucide-react';
import { money, type Invoice, type User, type Ticket, type Rate } from '@atlas/shared';
import { useData, useApp, PageTitle, Panel, Form, ErrorBox, Loading, Empty, Badge, Action, post, patch, options, date, setCsrf } from '../lib';
export function Billing() {
    const { data, error, loading } = useData<Invoice[]>('/invoices');
    return <><PageTitle title="Invoices & payments" subtitle="Track balances and record payments received outside Atlas."/>
        <ErrorBox message={error}/>
        {loading && !data ? <Loading/> : <>
        <div className="stats three">
            <div className="stat"><span>Total invoiced (excluding voids)</span><strong>{money(data?.filter(i=>i.status!=='VOID').reduce((sum,i)=>sum+i.amount,0)??0)}</strong></div>
            <div className="stat"><span>Payments recorded</span><strong>{money(data?.reduce((sum,i)=>sum+i.paid,0)??0)}</strong></div>
            <div className="stat"><span>Outstanding balance</span><strong>{money(data?.filter(i=>i.status==='OPEN').reduce((sum,i)=>sum+i.amount-i.paid,0)??0)}</strong></div>
        </div>
        <Panel><div className="table-wrap"><table><thead><tr><th>Invoice / shipment</th><th>Customer</th><th>Amount</th><th>Paid</th><th>Status</th><th/></tr></thead><tbody>
            {data?.map(i=><tr key={i.id}><td><strong>{i.number}</strong><small>{i.tracking}</small></td><td>{i.customer_name}</td><td>{money(i.amount)}</td><td>{money(i.paid)}</td><td><Badge value={i.status}/></td><td><Link className="button" to={'/billing/'+i.id}>View invoice</Link></td></tr>)}
        </tbody></table>{!data?.length && !error && <Empty>No invoices yet. Booking a shipment creates its invoice.</Empty>}</div></Panel></>}
    </>;
}
export function InvoiceDetail() {
    const { id } = useParams();
    const { user, reload, toast } = useApp();
    const { data, error, loading } = useData<{invoice:Invoice;payments:{id:string;reference:string;method:string;amount:number;created_at:string}[]}>('/invoices/'+id);
    if (loading && !data) return <Loading/>;
    if (!data || error) return <><PageTitle title="Invoice" action={<Link className="button" to="/billing">Back to invoices</Link>}/><ErrorBox message={error||'Invoice unavailable'}/><button onClick={reload}>Try again</button></>;
    const {invoice,payments}=data;
    return <><PageTitle title={invoice.number} subtitle="Invoice details and payment history" action={<div className="button-row no-print"><Link className="button" to="/billing">Back to invoices</Link><button onClick={()=>window.print()}><Printer size={16}/> Print invoice</button></div>}/>
        <div className="detail-grid"><Panel title="Invoice summary" action={<Badge value={invoice.status}/>}>
            <dl><dt>Billed to</dt><dd>{invoice.customer_name}</dd><dt>Shipment</dt><dd><Link to={'/shipments/'+invoice.shipment_id}>{invoice.tracking}</Link></dd><dt>Delivery service charge</dt><dd>{money(invoice.amount)}</dd><dt>Payments received</dt><dd>{money(invoice.paid)}</dd><dt>Balance due</dt><dd>{money(invoice.status==='VOID'?0:invoice.amount-invoice.paid)}</dd><dt>Issued</dt><dd>{date(invoice.created_at)}</dd></dl>
            <h3>Payment history</h3><div className="list">{payments.map(p=><div key={p.id}><strong>{money(p.amount)} · {p.reference}</strong><span>{p.method.replaceAll('_',' ')} · {date(p.created_at)}</span></div>)}</div>{!payments.length&&<p className="muted">No payments recorded for this invoice.</p>}
        </Panel>
        {user.role!=='CUSTOMER'&&invoice.status==='OPEN'&&<div className="no-print"><Panel title="Record an external payment"><p className="muted">This updates the ledger only. It does not charge a card or transfer money.</p>
            <Form key={invoice.id+':'+invoice.paid} fields={[{name:'amount',label:'Amount received (USD)',type:'number',min:.01,step:'.01',max:(invoice.amount-invoice.paid)/100},{name:'reference',label:'Unique payment reference'},{name:'method',label:'Payment method',type:'select',options:options(['BANK_TRANSFER','CASH','EXTERNAL_CARD'])}]} submit="Record payment" onSubmit={async v=>{await post(`/invoices/${invoice.id}/payments`,{...v,amount:Math.round(Number(v.amount)*100)});reload();toast('Payment recorded');}}/>
        </Panel></div>}</div>
    </>;
}
export function Support() { const { user, reload, toast } = useApp(), { data, error } = useData<Ticket[]>('/tickets'), { data: customers } = useData<User[]>(user.role !== 'CUSTOMER' ? '/users?role=CUSTOMER' : null); const [show, setShow] = useState(false), [selected, setSelected] = useState<string | null>(null); const { data: detail } = useData<{
    ticket: Ticket;
    messages: {
        id: string;
        actor_name: string;
        role: string;
        body: string;
        created_at: string;
    }[];
}>(selected ? '/tickets/' + selected : null); return <><PageTitle title="Support desk" subtitle="Keep delivery questions and resolutions in one conversation." action={<button className="primary" onClick={() => setShow(!show)}><Plus size={16}/> New ticket</button>}/><ErrorBox message={error}/>{show && <Panel title="Open a support ticket"><Form fields={[...(user.role !== 'CUSTOMER' ? [{ name: 'customerId', label: 'Customer', type: 'select', options: customers?.map(c => ({ value: c.id, label: c.name })) }] : []), { name: 'subject', label: 'Subject' }, { name: 'priority', label: 'Priority', type: 'select', options: options(['LOW', 'NORMAL', 'HIGH']), value: 'NORMAL' }, { name: 'body', label: 'How can we help?', type: 'textarea' }]} submit="Create ticket" onSubmit={async (v) => { const t = await post<{
    id: string;
}>('/tickets', v); setSelected(t.id); setShow(false); reload(); }}/></Panel>}<div className="detail-grid"><Panel title="Tickets"><div className="ticket-list">{data?.map(t => <button className={selected === t.id ? 'selected' : ''} key={t.id} onClick={() => setSelected(t.id)}><div><strong>{t.subject}</strong><small>{t.customer_name} · {date(t.updated_at)}</small></div><Badge value={t.status}/></button>)}{!data?.length && <Empty>No support tickets yet.</Empty>}</div></Panel><Panel title={detail?.ticket.subject || 'Conversation'}>{detail ? <><div className="messages">{detail.messages.map(m => <div className={'message ' + (m.role === 'CUSTOMER' ? 'customer-message' : '')} key={m.id}><strong>{m.actor_name}</strong><p>{m.body}</p><small>{date(m.created_at)}</small></div>)}</div>{detail.ticket.status !== 'CLOSED' && <Form fields={[{ name: 'body', label: 'Reply', type: 'textarea' }]} submit="Send reply" onSubmit={async (v) => { await post(`/tickets/${selected}/messages`, v); reload(); toast('Reply sent'); }}/>}{user.role !== 'CUSTOMER' && <Form key={selected + 'status'} fields={[{ name: 'status', label: 'Ticket status', type: 'select', value: detail.ticket.status, options: options(['OPEN', 'IN_PROGRESS', 'CLOSED']) }, { name: 'priority', label: 'Priority', type: 'select', value: detail.ticket.priority, options: options(['LOW', 'NORMAL', 'HIGH']) }]} submit="Update ticket" onSubmit={async (v) => { await patch('/tickets/' + selected, v); reload(); }}/>}</> : <Empty>Select a ticket to read the conversation.</Empty>}</Panel></div></>; }
export function Notifications() { const { data, error } = useData<{
    items: {
        id: string;
        title: string;
        body: string;
        link: string;
        read_at: string | null;
        created_at: string;
    }[];
    unread: number;
}>('/notifications'); return <><PageTitle title="Notifications" subtitle={`${data?.unread ?? 0} unread updates`} action={<Action run={() => post('/notifications/read', {})}><CheckCheck size={16}/> Mark all read</Action>}/><ErrorBox message={error}/><Panel><div className="notification-list">{data?.items.map(n => <Link key={n.id} to={n.link} className={!n.read_at ? 'unread' : ''}><div><strong>{n.title}</strong><p>{n.body}</p><small>{date(n.created_at)}</small></div>{!n.read_at && <span className="unread-dot"/>}</Link>)}{!data?.items.length && <Empty>No notifications yet.</Empty>}</div></Panel></>; }
interface Report {
    total: number;
    delivered: number;
    onTime: number;
    payments: {
        amount: number;
        count: number;
    };
    byService: {
        service: string;
        count: number;
        quoted: number;
    }[];
    shipments: {
        tracking: string;
        status: string;
        service: string;
        pickup_city: string;
        delivery_city: string;
        price: number;
        created_at: string;
    }[];
}
export function Reports() { const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)), [to, setTo] = useState(new Date().toISOString().slice(0, 10)); const query = new URLSearchParams({ from, to }); const { data, error } = useData<Report>('/reports?' + query); return <><PageTitle title="Performance reports" subtitle="Review shipment outcomes and recorded collections for a selected period." action={<a className="button" href={'/api/reports/export?' + query}><Download size={16}/> Export CSV</a>}/><Panel><div className="filters"><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label><span className="muted">Booking dates and payment dates are filtered independently.</span></div></Panel><ErrorBox message={error}/>{data && <><div className="stats"><div className="stat"><span>Shipments booked</span><strong>{data.total}</strong></div><div className="stat"><span>Delivered</span><strong>{data.delivered}</strong></div><div className="stat"><span>On-time delivered</span><strong>{data.delivered ? Math.round(data.onTime / data.delivered * 100) : 0}%</strong><small>{data.onTime} of {data.delivered} delivered shipments</small></div><div className="stat"><span>Recorded collections</span><strong>{money(data.payments.amount)}</strong><small>{data.payments.count} payment records</small></div></div><Panel title="Service breakdown"><div className="table-wrap"><table><thead><tr><th>Service</th><th>Bookings</th><th>Quoted value</th></tr></thead><tbody>{data.byService.map(s => <tr key={s.service}><td>{s.service}</td><td>{s.count}</td><td>{money(s.quoted)}</td></tr>)}</tbody></table></div><p className="muted">Quoted value includes all bookings, including cancelled shipments. It is not collected revenue.</p></Panel><Panel title="Shipments in this period"><div className="table-wrap"><table><thead><tr><th>Tracking</th><th>Route</th><th>Status</th><th>Quoted amount</th><th>Booked</th></tr></thead><tbody>{data.shipments.map(s => <tr key={s.tracking}><td>{s.tracking}</td><td>{s.pickup_city} → {s.delivery_city}</td><td><Badge value={s.status}/></td><td>{money(s.price)}</td><td>{date(s.created_at)}</td></tr>)}</tbody></table></div></Panel></>}</>; }
export function SettingsPage() { const { data, error } = useData<{
    company: string;
    supportEmail: string;
    currency: string;
}>('/admin/settings'), { data: rates } = useData<Rate[]>('/admin/rates'); const { reload, toast } = useApp(); return <><PageTitle title="Settings & pricing" subtitle="Manage company details and the rate cards used for new bookings."/><ErrorBox message={error}/>{data && <Panel title="Company profile"><Form fields={[{ name: 'company', label: 'Company name', value: data.company }, { name: 'supportEmail', label: 'Support email', type: 'email', value: data.supportEmail }]} submit="Save settings" onSubmit={async (v) => { await patch('/admin/settings', v); reload(); toast('Settings saved'); }}/><p className="muted">Ledger currency: {data.currency}. Existing quotes and invoices retain their original amounts.</p></Panel>}<div className="hub-grid">{rates?.map(r => <Panel title={r.service.replaceAll('_', ' ')} key={r.service}><Form fields={[{ name: 'base', label: 'Base fee (cents)', type: 'number', min: 0, value: r.base }, { name: 'per_km', label: 'Per km (cents)', type: 'number', min: 0, value: r.per_km }, { name: 'per_kg', label: 'Per kg (cents)', type: 'number', min: 0, value: r.per_kg }, { name: 'multiplier', label: 'Service multiplier', type: 'number', min: .1, max: 10, step: '.05', value: r.multiplier }, { name: 'sla_hours', label: 'Service window (hours)', type: 'number', min: 1, max: 720, value: r.sla_hours }]} submit="Update rate" onSubmit={async (v) => { await patch('/admin/rates/' + r.service, Object.fromEntries(Object.entries(v).map(([k, value]) => [k, Number(value)]))); reload(); toast('Rate updated for future bookings'); }}/></Panel>)}</div></>; }
export function Audit() { const { data, error } = useData<{
    id: string;
    actor_name: string;
    action: string;
    entity: string;
    entity_id: string;
    detail: string;
    created_at: string;
}[]>('/admin/audit'); return <><PageTitle title="Audit trail" subtitle="The latest 100 server-recorded actions across the workspace."/><ErrorBox message={error}/><Panel><div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>{data?.map(a => <tr key={a.id}><td>{date(a.created_at)}</td><td>{a.actor_name || 'System'}</td><td><Badge value={a.action}/></td><td>{a.entity}<small>{a.entity_id.slice(0, 12)}</small></td><td className="wrap-cell">{a.detail || '—'}</td></tr>)}</tbody></table></div></Panel></>; }
export function Account({ logout }: {
    logout: () => void;
}) { const { user } = useApp(); return <><PageTitle title="Your account" subtitle={user.name + ' · ' + user.email}/><Panel title="Change password"><p className="muted">Changing your password signs out every session, including this one.</p><Form fields={[{ name: 'current', label: 'Current password', type: 'password' }, { name: 'password', label: 'New password (at least 12 characters)', type: 'password' }]} submit="Change password" onSubmit={async (v) => { await post('/auth/password', v); setCsrf(''); logout(); }}/></Panel></>; }
