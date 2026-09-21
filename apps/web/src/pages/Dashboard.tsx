import { Link } from 'react-router-dom';
import { Package, Truck, CheckCheck, Clock, ArrowUpRight, Plus } from 'lucide-react';
import type { Shipment } from '@atlas/shared';
import { money, human } from '@atlas/shared';
import { useApp, useData, PageTitle, Panel, Loading, ErrorBox, Badge, date, Empty } from '../lib';
interface DashboardData {
    total: number;
    delivered: number;
    active: number;
    overdue: number;
    outstanding: number | null;
    statuses: {
        status: string;
        count: number;
    }[];
    services: {
        service: string;
        count: number;
    }[];
    daily: {
        day: string;
        count: number;
    }[];
    recent: Shipment[];
}
export function Dashboard() { const { user } = useApp(); const { data, error } = useData<DashboardData>('/dashboard'); if (!data)
    return error ? <ErrorBox message={error}/> : <Loading />; return <><PageTitle eyebrow="YOUR OPERATIONS, AT A GLANCE" title={user.role === 'DRIVER' ? 'Your delivery workspace' : user.role === 'CUSTOMER' ? 'Your shipments, connected.' : 'Operations overview'} subtitle={'Welcome back, ' + user.name.split(' ')[0] + '. Here’s where things stand.'} action={['ADMIN', 'DISPATCHER', 'CUSTOMER'].includes(user.role) && <Link className="primary button" to="/shipments/new"><Plus size={17}/> New shipment</Link>}/><ErrorBox message={error}/><div className="stats">{[{ label: 'Total shipments', value: data.total, icon: Package, note: 'All recorded bookings' }, { label: 'Active deliveries', value: data.active, icon: Truck, note: 'Currently in the network' }, { label: 'Delivered', value: data.delivered, icon: CheckCheck, note: 'Completed handoffs' }, { label: 'Past expected delivery', value: data.overdue, icon: Clock, note: 'Open shipments past their SLA' }].map((x, i) => <div className="stat" key={x.label}><div><span>{x.label}</span><x.icon size={20}/></div><strong>{x.value.toLocaleString()}</strong><small className={i === 3 && x.value ? 'warn' : ''}>{x.note}</small></div>)}</div><div className="dashboard-grid"><Panel title="Shipment activity" action={<span className="muted">Last 14 days</span>}><div className="bar-chart" aria-label="Bookings by day">{data.daily.length ? data.daily.map(d => <div className="bar-column" key={d.day}><span>{d.count}</span><div style={{ height: Math.max(8, d.count / Math.max(...data.daily.map(x => x.count)) * 140) }}/><small>{d.day.slice(5)}</small></div>) : <Empty>No recent bookings.</Empty>}</div></Panel><Panel title="Network snapshot"><div className="service-list">{data.services.map((s, i) => <div key={s.service}><span className={'service-dot dot-' + i}/><div><strong>{human(s.service)}</strong><small>{Math.round(s.count / Math.max(1, data.total) * 100)}% of shipments</small></div><b>{s.count}</b></div>)}</div>{data.outstanding !== null && <div className="balance"><span>Outstanding invoice balance</span><strong>{money(data.outstanding)}</strong><Link to="/billing">Review invoices <ArrowUpRight size={15}/></Link></div>}</Panel></div><Panel title="Recent shipments" action={<Link className="text-link" to="/shipments">View all shipments <ArrowUpRight size={16}/></Link>}><div className="table-wrap"><table><thead><tr><th>Shipment</th><th>Destination</th><th>Service</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{data.recent.map(s => <tr key={s.id}><td><Link className="tracking" to={'/shipments/' + s.id}>{s.tracking}</Link><small>{s.customer_name}</small></td><td>{s.delivery_city}</td><td>{human(s.service)}</td><td><Badge value={s.status}/></td><td>{date(s.created_at)}</td><td><Link aria-label={'Open ' + s.tracking} to={'/shipments/' + s.id}><ArrowUpRight size={18}/></Link></td></tr>)}</tbody></table>{!data.recent.length && <Empty>No shipments yet. Your first booking will appear here.</Empty>}</div></Panel></>; }
